import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { QueueService } from '../services/QueueService';

export const departmentRouter = Router();
departmentRouter.use(authenticate);

// List departments
departmentRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const departments = await QueueService.listDepartments(req.tenantId!);
    res.json(departments);
  } catch (error) {
    next(error);
  }
});

// Create department
departmentRouter.post('/', authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description, color, priority, welcomeMessage, autoAssignChannels } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const dept = await QueueService.createDepartment(req.tenantId!, {
      name, description, color, priority, welcomeMessage, autoAssignChannels,
    });
    res.status(201).json(dept);
  } catch (error) {
    next(error);
  }
});

// Update department
departmentRouter.put('/:id', authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dept = await QueueService.updateDepartment(req.params.id, req.tenantId!, req.body);
    res.json(dept);
  } catch (error) {
    next(error);
  }
});

// Delete department
departmentRouter.delete('/:id', authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await QueueService.deleteDepartment(req.params.id, req.tenantId!);
    res.json({ message: 'Department deleted' });
  } catch (error) {
    next(error);
  }
});

// Add member to department
departmentRouter.post('/:id/members', authorize('admin', 'supervisor'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, skills, skillLevel } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const member = await QueueService.addMember(req.params.id, userId, skills, skillLevel);
    res.status(201).json(member);
  } catch (error) {
    next(error);
  }
});

// Remove member from department
departmentRouter.delete('/:id/members/:userId', authorize('admin', 'supervisor'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await QueueService.removeMember(req.params.id, req.params.userId);
    res.json({ message: 'Member removed' });
  } catch (error) {
    next(error);
  }
});

// Get queue stats
departmentRouter.get('/queue/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await QueueService.getQueueStats(req.tenantId!);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Process queue manually
departmentRouter.post('/queue/process', authorize('admin', 'supervisor'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const routed = await QueueService.processQueue(req.tenantId!);
    res.json({ message: `${routed} conversations routed`, routed });
  } catch (error) {
    next(error);
  }
});
