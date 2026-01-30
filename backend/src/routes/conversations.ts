import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ConversationService } from '../services/ConversationService';
import { OutboundService } from '../services/OutboundService';
import { QueueService } from '../services/QueueService';
import { AppDataSource } from '../config/database';
import { Message } from '../entities/Message';

export const conversationRouter = Router();

conversationRouter.use(authenticate);

// List conversations
conversationRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, channelId, assignedToId, departmentId, page, limit } = req.query;
    const result = await ConversationService.list(req.tenantId!, {
      status: status as string,
      channelId: channelId as string,
      assignedToId: assignedToId as string,
      departmentId: departmentId as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get conversation by ID with messages
conversationRouter.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conversation = await ConversationService.getById(req.params.id, req.tenantId!);
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

// Get messages for conversation (paginated)
conversationRouter.get('/:id/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const messages = await AppDataSource.getRepository(Message).find({
      where: { conversationId: req.params.id },
      order: { createdAt: 'DESC' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
      relations: ['agent'],
    });
    messages.reverse();
    res.json(messages);
  } catch (error) {
    next(error);
  }
});

// Send message as agent → save to DB + send to external channel
conversationRouter.post('/:id/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { content, type, attachments } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    // Save message in database
    const message = await ConversationService.addMessage({
      conversationId: req.params.id,
      content,
      type,
      sender: 'agent',
      agentId: req.userId,
      attachments,
    });

    // Track first response time
    await ConversationService.trackFirstResponse(req.params.id);

    // Route message to customer's external channel (WhatsApp, Instagram, etc.)
    const outboundResult = await OutboundService.sendToChannel(req.params.id, message.id);

    res.status(201).json({
      ...message,
      outbound: {
        sent: outboundResult.sent,
        error: outboundResult.error,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Assign conversation (manual or via queue)
conversationRouter.post('/:id/assign', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.body;
    if (agentId) {
      // Manual assignment
      const conversation = await ConversationService.assign(
        req.params.id,
        agentId,
        req.tenantId!
      );
      res.json(conversation);
    } else {
      // Self-assign
      const conversation = await ConversationService.assign(
        req.params.id,
        req.userId!,
        req.tenantId!
      );
      res.json(conversation);
    }
  } catch (error) {
    next(error);
  }
});

// Route conversation via queue (auto-assign best agent)
conversationRouter.post('/:id/route', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { departmentId } = req.body;
    const result = await QueueService.routeConversation(req.params.id, req.tenantId!, departmentId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Transfer to department
conversationRouter.post('/:id/transfer/department', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { departmentId, reason } = req.body;
    if (!departmentId) return res.status(400).json({ error: 'departmentId is required' });

    const result = await QueueService.transferToDepartment(
      req.params.id, req.tenantId!, departmentId, req.userId!, reason
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Transfer to specific agent
conversationRouter.post('/:id/transfer/agent', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { agentId, reason } = req.body;
    if (!agentId) return res.status(400).json({ error: 'agentId is required' });

    const result = await QueueService.transferToAgent(
      req.params.id, req.tenantId!, agentId, req.userId!, reason
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get transfer history
conversationRouter.get('/:id/transfers', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transfers = await QueueService.getTransferHistory(req.params.id);
    res.json(transfers);
  } catch (error) {
    next(error);
  }
});

// Close conversation
conversationRouter.post('/:id/close', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conversation = await ConversationService.close(req.params.id, req.tenantId!);
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});
