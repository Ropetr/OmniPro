import { AppDataSource } from '../config/database';
import { Conversation } from '../entities/Conversation';
import { Department } from '../entities/Department';
import { UserDepartment } from '../entities/UserDepartment';
import { User } from '../entities/User';
import { ConversationTransfer } from '../entities/ConversationTransfer';
import { getRedis } from '../config/redis';
import { getIO } from '../config/socket';
import { ConversationService } from './ConversationService';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

const convRepo = () => AppDataSource.getRepository(Conversation);
const deptRepo = () => AppDataSource.getRepository(Department);
const udRepo = () => AppDataSource.getRepository(UserDepartment);
const userRepo = () => AppDataSource.getRepository(User);
const transferRepo = () => AppDataSource.getRepository(ConversationTransfer);

interface AgentScore {
  userId: string;
  name: string;
  score: number;
  activeChats: number;
  maxChats: number;
  skillLevel: number;
}

export class QueueService {
  /**
   * Route a conversation to the best available agent in a department.
   * Scoring algorithm:
   *   - Available capacity (max - current): weighted 50%
   *   - Skill level: weighted 30%
   *   - Online status priority: weighted 20%
   */
  static async routeConversation(conversationId: string, tenantId: string, departmentId?: string): Promise<{
    assigned: boolean;
    agentId?: string;
    agentName?: string;
    departmentId?: string;
    queuePosition?: number;
  }> {
    const conversation = await convRepo().findOne({
      where: { id: conversationId, tenantId },
      relations: ['channel'],
    });
    if (!conversation) throw new AppError('Conversation not found', 404);

    // Determine target department
    let targetDeptId = departmentId || conversation.departmentId;

    // If no department specified, try auto-routing by channel
    if (!targetDeptId) {
      targetDeptId = await this.findDepartmentByChannel(tenantId, conversation.channelId);
    }

    // If still no department, use default (first active department)
    if (!targetDeptId) {
      const defaultDept = await deptRepo().findOne({
        where: { tenantId, isActive: true },
        order: { priority: 'DESC' },
      });
      if (defaultDept) targetDeptId = defaultDept.id;
    }

    // Update conversation department
    if (targetDeptId) {
      conversation.departmentId = targetDeptId;
    }

    // Find best agent
    const bestAgent = await this.findBestAgent(tenantId, targetDeptId);

    if (bestAgent) {
      // Assign to agent
      conversation.assignedToId = bestAgent.userId;
      conversation.status = 'assigned';
      conversation.queueStatus = 'routed';
      conversation.firstResponseAt = conversation.firstResponseAt || undefined;
      await convRepo().save(conversation);

      // Notify via socket
      this.notifyAssignment(tenantId, conversationId, bestAgent.userId, bestAgent.name);

      logger.info(`Conversation ${conversationId} routed to agent ${bestAgent.name} (score: ${bestAgent.score.toFixed(1)})`);

      return {
        assigned: true,
        agentId: bestAgent.userId,
        agentName: bestAgent.name,
        departmentId: targetDeptId,
      };
    }

    // No agent available - put in queue
    const position = await this.addToQueue(conversation, tenantId, targetDeptId);

    return {
      assigned: false,
      departmentId: targetDeptId,
      queuePosition: position,
    };
  }

  /**
   * Find best agent based on scoring algorithm
   */
  static async findBestAgent(tenantId: string, departmentId?: string): Promise<AgentScore | null> {
    // Get online/away agents for this tenant
    const redis = getRedis();
    const onlineAgentIds = await redis.smembers(`online_agents:${tenantId}`);

    if (onlineAgentIds.length === 0) return null;

    // Get agents with their department membership
    let query = userRepo().createQueryBuilder('u')
      .where('u.tenantId = :tenantId', { tenantId })
      .andWhere('u.isActive = true')
      .andWhere('u.id IN (:...onlineIds)', { onlineIds: onlineAgentIds });

    const onlineAgents = await query.getMany();
    if (onlineAgents.length === 0) return null;

    // If department specified, filter by department membership
    let departmentMembers: UserDepartment[] = [];
    if (departmentId) {
      departmentMembers = await udRepo().find({
        where: { departmentId, isActive: true },
      });

      const memberIds = departmentMembers.map(m => m.userId);
      const deptAgents = onlineAgents.filter(a => memberIds.includes(a.id));

      // If no dept agents online, fall back to all online agents
      if (deptAgents.length > 0) {
        return this.scoreAgents(deptAgents, departmentMembers, tenantId);
      }
    }

    // Score all online agents (no department filter or fallback)
    return this.scoreAgents(onlineAgents, departmentMembers, tenantId);
  }

  /**
   * Score agents and return the best one
   */
  private static async scoreAgents(
    agents: User[],
    deptMembers: UserDepartment[],
    tenantId: string,
  ): Promise<AgentScore | null> {
    const scored: AgentScore[] = [];

    for (const agent of agents) {
      // Count active conversations for this agent
      const activeChats = await convRepo().count({
        where: {
          assignedToId: agent.id,
          tenantId,
          status: 'assigned' as any,
        },
      });

      // Check capacity
      if (activeChats >= agent.maxConcurrentChats) continue; // Agent full

      // Get skill level from department membership
      const membership = deptMembers.find(m => m.userId === agent.id);
      const skillLevel = membership?.skillLevel || 5;

      // Calculate score
      const capacityRatio = (agent.maxConcurrentChats - activeChats) / agent.maxConcurrentChats;
      const capacityScore = capacityRatio * 50; // 0-50 points
      const skillScore = (skillLevel / 10) * 30; // 0-30 points
      const statusScore = agent.status === 'online' ? 20 : (agent.status === 'away' ? 5 : 0); // 0-20 points

      const totalScore = capacityScore + skillScore + statusScore;

      scored.push({
        userId: agent.id,
        name: agent.name,
        score: totalScore,
        activeChats,
        maxChats: agent.maxConcurrentChats,
        skillLevel,
      });
    }

    if (scored.length === 0) return null;

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored[0];
  }

  /**
   * Add conversation to waiting queue
   */
  private static async addToQueue(conversation: Conversation, tenantId: string, departmentId?: string): Promise<number> {
    // Count conversations ahead in queue
    const qb = convRepo().createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.queueStatus = :qs', { qs: 'queued' })
      .andWhere('c.status IN (:...statuses)', { statuses: ['open', 'pending'] });

    if (departmentId) {
      qb.andWhere('c.departmentId = :departmentId', { departmentId });
    }

    const ahead = await qb.getCount();
    const position = ahead + 1;

    conversation.queueStatus = 'queued';
    conversation.status = 'pending';
    conversation.queuePosition = position;
    conversation.queuedAt = new Date();
    if (departmentId) conversation.departmentId = departmentId;
    await convRepo().save(conversation);

    // Notify tenant that conversation is waiting
    try {
      const io = getIO();
      io.of('/agents').to(`tenant:${tenantId}`).emit('queue_updated', {
        conversationId: conversation.id,
        position,
        departmentId,
      });
    } catch (e) {}

    // Notify visitor about queue position
    try {
      const io = getIO();
      io.of('/visitors').to(`visitor:${conversation.contactId}`).emit('queue_position', {
        position,
        message: position === 1
          ? 'Você é o próximo da fila! Um agente atenderá em breve.'
          : `Você está na posição ${position} da fila. Aguarde um momento.`,
      });
    } catch (e) {}

    logger.info(`Conversation ${conversation.id} queued at position ${position}`);
    return position;
  }

  /**
   * Transfer conversation to another department
   */
  static async transferToDepartment(
    conversationId: string,
    tenantId: string,
    toDepartmentId: string,
    fromAgentId: string,
    reason?: string,
  ) {
    const conversation = await convRepo().findOne({
      where: { id: conversationId, tenantId },
    });
    if (!conversation) throw new AppError('Conversation not found', 404);

    const toDept = await deptRepo().findOne({ where: { id: toDepartmentId, tenantId } });
    if (!toDept) throw new AppError('Department not found', 404);

    // Record transfer
    const transfer = transferRepo().create({
      conversationId,
      fromDepartmentId: conversation.departmentId,
      toDepartmentId,
      fromAgentId,
      reason,
    });
    await transferRepo().save(transfer);

    // Add system message
    await ConversationService.addMessage({
      conversationId,
      content: `Conversa transferida para o departamento "${toDept.name}"${reason ? `: ${reason}` : ''}`,
      sender: 'system',
    });

    // Send welcome message from new department
    if (toDept.welcomeMessage) {
      await ConversationService.addMessage({
        conversationId,
        content: toDept.welcomeMessage,
        sender: 'system',
      });
    }

    // Unassign and re-route
    conversation.assignedToId = null as any;
    conversation.departmentId = toDepartmentId;
    conversation.status = 'open';
    conversation.queueStatus = 'routing';
    await convRepo().save(conversation);

    // Try to route to new department
    const result = await this.routeConversation(conversationId, tenantId, toDepartmentId);

    // Notify previous agent
    try {
      const io = getIO();
      io.of('/agents').to(`agent:${fromAgentId}`).emit('conversation_transferred', {
        conversationId,
        toDepartment: toDept.name,
      });
    } catch (e) {}

    logger.info(`Conversation ${conversationId} transferred to dept "${toDept.name}" by agent ${fromAgentId}`);

    return { transfer, routing: result };
  }

  /**
   * Transfer conversation directly to another agent
   */
  static async transferToAgent(
    conversationId: string,
    tenantId: string,
    toAgentId: string,
    fromAgentId: string,
    reason?: string,
  ) {
    const conversation = await convRepo().findOne({
      where: { id: conversationId, tenantId },
    });
    if (!conversation) throw new AppError('Conversation not found', 404);

    const toAgent = await userRepo().findOne({ where: { id: toAgentId, tenantId } });
    if (!toAgent) throw new AppError('Agent not found', 404);

    // Record transfer
    const transfer = transferRepo().create({
      conversationId,
      fromDepartmentId: conversation.departmentId,
      toDepartmentId: conversation.departmentId,
      fromAgentId,
      toAgentId,
      reason,
    });
    await transferRepo().save(transfer);

    // Add system message
    await ConversationService.addMessage({
      conversationId,
      content: `Conversa transferida para ${toAgent.name}${reason ? `: ${reason}` : ''}`,
      sender: 'system',
    });

    // Assign to new agent
    conversation.assignedToId = toAgentId;
    conversation.status = 'assigned';
    conversation.queueStatus = 'routed';
    await convRepo().save(conversation);

    // Notify agents
    this.notifyAssignment(tenantId, conversationId, toAgentId, toAgent.name);

    try {
      const io = getIO();
      io.of('/agents').to(`agent:${fromAgentId}`).emit('conversation_transferred', {
        conversationId,
        toAgent: toAgent.name,
      });
    } catch (e) {}

    logger.info(`Conversation ${conversationId} transferred to agent "${toAgent.name}"`);
    return { transfer };
  }

  /**
   * Process the queue - called periodically or when agent becomes available
   */
  static async processQueue(tenantId: string) {
    const queued = await convRepo().find({
      where: { tenantId, queueStatus: 'queued' as any },
      order: { queuedAt: 'ASC' },
      take: 10,
    });

    let routed = 0;
    for (const conv of queued) {
      const result = await this.routeConversation(conv.id, tenantId, conv.departmentId);
      if (result.assigned) routed++;
      else break; // No more agents available
    }

    if (routed > 0) {
      logger.info(`Queue processed for tenant ${tenantId}: ${routed} conversations routed`);
    }
    return routed;
  }

  /**
   * Find department by channel auto-assign config
   */
  private static async findDepartmentByChannel(tenantId: string, channelId: string): Promise<string | null> {
    const departments = await deptRepo().find({
      where: { tenantId, isActive: true },
    });

    for (const dept of departments) {
      if (dept.autoAssignChannels?.includes(channelId)) {
        return dept.id;
      }
    }
    return null;
  }

  /**
   * Notify assignment via Socket.IO
   */
  private static notifyAssignment(tenantId: string, conversationId: string, agentId: string, agentName: string) {
    try {
      const io = getIO();
      io.of('/agents').to(`tenant:${tenantId}`).emit('conversation_assigned', {
        conversationId,
        agentId,
        agentName,
      });
      io.of('/agents').to(`agent:${agentId}`).emit('new_assignment', {
        conversationId,
        message: 'Nova conversa atribuída a você',
      });
    } catch (e) {}
  }

  // === Department CRUD ===

  static async listDepartments(tenantId: string) {
    return deptRepo().find({
      where: { tenantId },
      relations: ['members', 'members.user'],
      order: { priority: 'DESC', name: 'ASC' },
    });
  }

  static async createDepartment(tenantId: string, data: {
    name: string;
    description?: string;
    color?: string;
    priority?: number;
    welcomeMessage?: string;
    autoAssignChannels?: string[];
  }) {
    const dept = deptRepo().create({ ...data, tenantId });
    return deptRepo().save(dept);
  }

  static async updateDepartment(id: string, tenantId: string, data: Partial<Department>) {
    const dept = await deptRepo().findOne({ where: { id, tenantId } });
    if (!dept) throw new AppError('Department not found', 404);
    Object.assign(dept, data);
    return deptRepo().save(dept);
  }

  static async deleteDepartment(id: string, tenantId: string) {
    const dept = await deptRepo().findOne({ where: { id, tenantId } });
    if (!dept) throw new AppError('Department not found', 404);
    await deptRepo().remove(dept);
  }

  static async addMember(departmentId: string, userId: string, skills?: string[], skillLevel?: number) {
    const existing = await udRepo().findOne({ where: { departmentId, userId } });
    if (existing) {
      existing.skills = skills || existing.skills;
      existing.skillLevel = skillLevel || existing.skillLevel;
      return udRepo().save(existing);
    }

    const member = udRepo().create({
      departmentId,
      userId,
      skills: skills || [],
      skillLevel: skillLevel || 5,
    });
    return udRepo().save(member);
  }

  static async removeMember(departmentId: string, userId: string) {
    await udRepo().delete({ departmentId, userId });
  }

  static async getTransferHistory(conversationId: string) {
    return transferRepo().find({
      where: { conversationId },
      relations: ['fromDepartment', 'toDepartment', 'fromAgent', 'toAgent'],
      order: { transferredAt: 'ASC' },
    });
  }

  /**
   * Get queue stats for a tenant
   */
  static async getQueueStats(tenantId: string) {
    const departments = await deptRepo().find({ where: { tenantId, isActive: true } });

    const stats = [];
    for (const dept of departments) {
      const waiting = await convRepo().count({
        where: { tenantId, departmentId: dept.id, queueStatus: 'queued' as any },
      });

      const active = await convRepo().count({
        where: { tenantId, departmentId: dept.id, status: 'assigned' as any },
      });

      const members = await udRepo().count({ where: { departmentId: dept.id, isActive: true } });

      const redis = getRedis();
      const onlineAgentIds = await redis.smembers(`online_agents:${tenantId}`);
      const deptMembers = await udRepo().find({ where: { departmentId: dept.id, isActive: true } });
      const onlineInDept = deptMembers.filter(m => onlineAgentIds.includes(m.userId)).length;

      stats.push({
        department: { id: dept.id, name: dept.name, color: dept.color },
        waiting,
        active,
        totalMembers: members,
        onlineMembers: onlineInDept,
      });
    }

    // Unassigned (no department)
    const unassigned = await convRepo().count({
      where: { tenantId, departmentId: undefined, queueStatus: 'queued' as any },
    });

    return { departments: stats, unassigned };
  }
}
