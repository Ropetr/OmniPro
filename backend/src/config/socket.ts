import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { getRedis } from './redis';

let io: Server;

export function initializeSocketIO(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? [process.env.APP_URL!, process.env.WIDGET_URL!]
        : '*',
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // Agent namespace (dashboard operators)
  const agentNsp = io.of('/agents');
  agentNsp.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      socket.data.userId = decoded.userId;
      socket.data.tenantId = decoded.tenantId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  agentNsp.on('connection', (socket: Socket) => {
    const { userId, tenantId } = socket.data;
    logger.info(`Agent connected: ${userId} (tenant: ${tenantId})`);

    // Join tenant room
    socket.join(`tenant:${tenantId}`);
    socket.join(`agent:${userId}`);

    // Track online status
    const redis = getRedis();
    redis.sadd(`online_agents:${tenantId}`, userId);

    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      logger.info(`Agent ${userId} joined conversation ${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('typing', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('agent_typing', {
        agentId: userId,
        conversationId: data.conversationId,
      });
    });

    socket.on('disconnect', () => {
      redis.srem(`online_agents:${tenantId}`, userId);
      logger.info(`Agent disconnected: ${userId}`);
    });
  });

  // Visitor namespace (widget/external contacts)
  const visitorNsp = io.of('/visitors');
  visitorNsp.on('connection', (socket: Socket) => {
    const { visitorId, tenantId } = socket.handshake.auth;
    logger.info(`Visitor connected: ${visitorId} (tenant: ${tenantId})`);

    socket.join(`visitor:${visitorId}`);
    if (tenantId) socket.join(`tenant:${tenantId}`);

    socket.on('send_message', (data) => {
      // Forward to conversation handler
      agentNsp.to(`tenant:${tenantId}`).emit('new_visitor_message', {
        ...data,
        visitorId,
      });
    });

    socket.on('typing', () => {
      agentNsp.to(`tenant:${tenantId}`).emit('visitor_typing', { visitorId });
    });

    socket.on('disconnect', () => {
      logger.info(`Visitor disconnected: ${visitorId}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
