import 'dotenv/config';
import http from 'http';
import app from './app';
import { initializeDatabase } from './config/database';
import { initializeSocketIO } from './config/socket';
import { initializeRedis } from './config/redis';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database connected successfully');

    // Initialize Redis
    await initializeRedis();
    logger.info('Redis connected successfully');

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.IO
    initializeSocketIO(server);
    logger.info('Socket.IO initialized');

    server.listen(PORT, () => {
      logger.info(`OmniPro Backend running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
