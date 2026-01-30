import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ConversationService } from '../services/ConversationService';
import { AppDataSource } from '../config/database';
import { Message } from '../entities/Message';

export const conversationRouter = Router();

conversationRouter.use(authenticate);

// List conversations
conversationRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, channelId, assignedToId, page, limit } = req.query;
    const result = await ConversationService.list(req.tenantId!, {
      status: status as string,
      channelId: channelId as string,
      assignedToId: assignedToId as string,
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
    });
    messages.reverse();
    res.json(messages);
  } catch (error) {
    next(error);
  }
});

// Send message as agent
conversationRouter.post('/:id/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { content, type, attachments } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const message = await ConversationService.addMessage({
      conversationId: req.params.id,
      content,
      type,
      sender: 'agent',
      agentId: req.userId,
      attachments,
    });

    // TODO: Send to external channel based on conversation channel type

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

// Assign conversation
conversationRouter.post('/:id/assign', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.body;
    const conversation = await ConversationService.assign(
      req.params.id,
      agentId || req.userId!,
      req.tenantId!
    );
    res.json(conversation);
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
