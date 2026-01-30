import { AppDataSource } from '../config/database';
import { Conversation } from '../entities/Conversation';
import { Message } from '../entities/Message';
import { Contact } from '../entities/Contact';
import { getIO } from '../config/socket';
import { AppError } from '../middleware/errorHandler';
import { AIService } from './AIService';
import { logger } from '../utils/logger';

const convRepo = () => AppDataSource.getRepository(Conversation);
const msgRepo = () => AppDataSource.getRepository(Message);
const contactRepo = () => AppDataSource.getRepository(Contact);

export class ConversationService {
  // List conversations for a tenant
  static async list(tenantId: string, filters: {
    status?: string;
    channelId?: string;
    assignedToId?: string;
    departmentId?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { status, channelId, assignedToId, departmentId, page = 1, limit = 50 } = filters;

    const qb = convRepo().createQueryBuilder('c')
      .leftJoinAndSelect('c.contact', 'contact')
      .leftJoinAndSelect('c.channel', 'channel')
      .leftJoinAndSelect('c.assignedTo', 'agent')
      .leftJoinAndSelect('c.department', 'department')
      .where('c.tenantId = :tenantId', { tenantId });

    if (status) qb.andWhere('c.status = :status', { status });
    if (channelId) qb.andWhere('c.channelId = :channelId', { channelId });
    if (assignedToId) qb.andWhere('c.assignedToId = :assignedToId', { assignedToId });
    if (departmentId) qb.andWhere('c.departmentId = :departmentId', { departmentId });

    qb.orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST')
      .skip((page - 1) * limit)
      .take(limit);

    const [conversations, total] = await qb.getManyAndCount();
    return { conversations, total, page, limit };
  }

  // Get conversation with messages
  static async getById(id: string, tenantId: string) {
    const conversation = await convRepo().findOne({
      where: { id, tenantId },
      relations: ['contact', 'channel', 'assignedTo', 'messages'],
    });
    if (!conversation) throw new AppError('Conversation not found', 404);

    // Sort messages by date
    conversation.messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return conversation;
  }

  // Create or get conversation from external channel
  static async findOrCreate(data: {
    tenantId: string;
    channelId: string;
    contactExternalId: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    source: string;
  }) {
    // Find or create contact
    let contact = await contactRepo().findOne({
      where: { externalId: data.contactExternalId, tenantId: data.tenantId },
    });
    if (!contact) {
      contact = contactRepo().create({
        name: data.contactName || 'Visitante',
        email: data.contactEmail,
        phone: data.contactPhone,
        externalId: data.contactExternalId,
        source: data.source,
        tenantId: data.tenantId,
      });
      await contactRepo().save(contact);
    }

    // Find open conversation
    let conversation = await convRepo().findOne({
      where: {
        contactId: contact.id,
        channelId: data.channelId,
        tenantId: data.tenantId,
        status: 'open' as any,
      },
      relations: ['contact', 'channel'],
    });

    if (!conversation) {
      // Also check pending/assigned
      conversation = await convRepo().findOne({
        where: [
          { contactId: contact.id, channelId: data.channelId, tenantId: data.tenantId, status: 'pending' },
          { contactId: contact.id, channelId: data.channelId, tenantId: data.tenantId, status: 'assigned' },
        ],
        relations: ['contact', 'channel'],
      });
    }

    if (!conversation) {
      conversation = convRepo().create({
        status: 'open',
        channelId: data.channelId,
        contactId: contact.id,
        tenantId: data.tenantId,
        lastMessageAt: new Date(),
      });
      await convRepo().save(conversation);
      conversation.contact = contact;
    }

    return conversation;
  }

  // Add message to conversation
  static async addMessage(data: {
    conversationId: string;
    content: string;
    type?: string;
    sender: 'contact' | 'agent' | 'bot' | 'system';
    agentId?: string;
    externalId?: string;
    attachments?: any[];
    metadata?: Record<string, any>;
  }) {
    const message = msgRepo().create({
      conversationId: data.conversationId,
      content: data.content,
      type: (data.type || 'text') as any,
      sender: data.sender,
      agentId: data.agentId,
      externalId: data.externalId,
      attachments: data.attachments,
      metadata: data.metadata,
      status: 'sent',
    });
    await msgRepo().save(message);

    // Update conversation timestamp
    await convRepo().update(data.conversationId, {
      lastMessageAt: new Date(),
      ...(data.sender === 'contact' && { status: 'open' as any }),
    });

    // Emit via Socket.IO
    try {
      const io = getIO();
      io.of('/agents').to(`conversation:${data.conversationId}`).emit('new_message', message);

      // Also notify tenant room for new conversations
      const conv = await convRepo().findOne({ where: { id: data.conversationId } });
      if (conv) {
        io.of('/agents').to(`tenant:${conv.tenantId}`).emit('conversation_updated', {
          conversationId: conv.id,
          lastMessage: message,
        });
      }
    } catch (e) {
      logger.debug('Socket.IO not available for message broadcast');
    }

    return message;
  }

  // Assign conversation to agent
  static async assign(conversationId: string, agentId: string, tenantId: string) {
    const conversation = await convRepo().findOne({
      where: { id: conversationId, tenantId },
    });
    if (!conversation) throw new AppError('Conversation not found', 404);

    conversation.assignedToId = agentId;
    conversation.status = 'assigned';
    conversation.isBot = false;
    await convRepo().save(conversation);

    // Notify via socket
    try {
      const io = getIO();
      io.of('/agents').to(`tenant:${tenantId}`).emit('conversation_assigned', {
        conversationId,
        agentId,
      });
    } catch (e) {}

    return conversation;
  }

  // Close conversation
  static async close(conversationId: string, tenantId: string) {
    const conversation = await convRepo().findOne({
      where: { id: conversationId, tenantId },
    });
    if (!conversation) throw new AppError('Conversation not found', 404);

    conversation.status = 'closed';
    await convRepo().save(conversation);

    // Add system message
    await this.addMessage({
      conversationId,
      content: 'Conversa encerrada',
      sender: 'system',
    });

    return conversation;
  }

  // Track first response time (SLA metric)
  static async trackFirstResponse(conversationId: string) {
    const conversation = await convRepo().findOne({ where: { id: conversationId } });
    if (conversation && !conversation.firstResponseAt) {
      conversation.firstResponseAt = new Date();
      await convRepo().save(conversation);
    }
  }

  // Process incoming message with AI if bot is active
  static async processWithAI(conversationId: string, tenantId: string, message: string) {
    try {
      const conversation = await convRepo().findOne({
        where: { id: conversationId, tenantId },
        relations: ['channel'],
      });
      if (!conversation) return;

      const reply = await AIService.generateReply(tenantId, conversationId, message);
      if (reply) {
        const botMessage = await this.addMessage({
          conversationId,
          content: reply,
          sender: 'bot',
        });

        // Send bot reply to external channel
        const { OutboundService } = require('./OutboundService');
        await OutboundService.sendToChannel(conversationId, botMessage.id);

        return reply;
      }
    } catch (error) {
      logger.error('AI processing failed:', error);
    }
    return null;
  }
}
