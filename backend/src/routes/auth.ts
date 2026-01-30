import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';

export const authRouter = Router();

// Register new tenant + admin user
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, tenantName } = req.body;

    if (!name || !email || !password || !tenantName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const result = await AuthService.register({ name, email, password, tenantName });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// Login
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await AuthService.login(email, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Refresh token
authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const tokens = await AuthService.refreshToken(refreshToken);
    res.json(tokens);
  } catch (error) {
    next(error);
  }
});

// Get current user
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: req.userId },
      relations: ['tenant'],
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { password, ...userData } = user as any;
    res.json(userData);
  } catch (error) {
    next(error);
  }
});
