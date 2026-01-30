import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';
import { Conversation } from '../entities/Conversation';
import { Message } from '../entities/Message';
import { Contact } from '../entities/Contact';
import { Channel } from '../entities/Channel';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

// Dashboard stats
dashboardRouter.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId!;

    const [
      totalConversations,
      openConversations,
      totalContacts,
      totalMessages,
      channels,
    ] = await Promise.all([
      AppDataSource.getRepository(Conversation).count({ where: { tenantId } }),
      AppDataSource.getRepository(Conversation).count({ where: { tenantId, status: 'open' as any } }),
      AppDataSource.getRepository(Contact).count({ where: { tenantId } }),
      AppDataSource.getRepository(Message)
        .createQueryBuilder('m')
        .innerJoin('m.conversation', 'c')
        .where('c.tenantId = :tenantId', { tenantId })
        .getCount(),
      AppDataSource.getRepository(Channel).find({ where: { tenantId } }),
    ]);

    // Conversations by channel type
    const byChannel = await AppDataSource.getRepository(Conversation)
      .createQueryBuilder('c')
      .select('ch.type', 'channelType')
      .addSelect('COUNT(*)', 'count')
      .innerJoin('c.channel', 'ch')
      .where('c.tenantId = :tenantId', { tenantId })
      .groupBy('ch.type')
      .getRawMany();

    // Today's conversations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayConversations = await AppDataSource.getRepository(Conversation).count({
      where: {
        tenantId,
        createdAt: new Date(today.toISOString()) as any,
      },
    });

    res.json({
      totalConversations,
      openConversations,
      totalContacts,
      totalMessages,
      todayConversations,
      channelsCount: channels.length,
      activeChannels: channels.filter(c => c.isActive).length,
      conversationsByChannel: byChannel,
    });
  } catch (error) {
    next(error);
  }
});
