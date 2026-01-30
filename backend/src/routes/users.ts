import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';

export const userRouter = Router();
userRouter.use(authenticate);

const userRepo = () => AppDataSource.getRepository(User);

// List users (agents) in tenant
userRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await userRepo().find({
      where: { tenantId: req.tenantId },
      select: ['id', 'name', 'email', 'role', 'status', 'avatar', 'isActive', 'maxConcurrentChats', 'createdAt'],
      order: { name: 'ASC' },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Create user (agent)
userRouter.post('/', authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, role, maxConcurrentChats } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const existing = await userRepo().findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = userRepo().create({
      name,
      email,
      password: hashedPassword,
      role: role || 'agent',
      maxConcurrentChats: maxConcurrentChats || 5,
      tenantId: req.tenantId,
    });
    await userRepo().save(user);

    const { password: _, ...userData } = user as any;
    res.status(201).json(userData);
  } catch (error) {
    next(error);
  }
});

// Update user
userRouter.put('/:id', authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await userRepo().findOne({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { name, role, maxConcurrentChats, isActive } = req.body;
    Object.assign(user, { name, role, maxConcurrentChats, isActive });
    await userRepo().save(user);

    const { password: _, ...userData } = user as any;
    res.json(userData);
  } catch (error) {
    next(error);
  }
});

// Update own status
userRouter.patch('/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!['online', 'away', 'offline'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await userRepo().update(req.userId!, { status });
    res.json({ status });
  } catch (error) {
    next(error);
  }
});
