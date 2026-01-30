import { Router } from 'express';
import { authRouter } from './auth';
import { conversationRouter } from './conversations';
import { channelRouter } from './channels';
import { contactRouter } from './contacts';
import { webhookRouter } from './webhooks';
import { aiRouter } from './ai';
import { dashboardRouter } from './dashboard';
import { userRouter } from './users';

export const router = Router();

router.use('/auth', authRouter);
router.use('/conversations', conversationRouter);
router.use('/channels', channelRouter);
router.use('/contacts', contactRouter);
router.use('/webhooks', webhookRouter);
router.use('/ai', aiRouter);
router.use('/dashboard', dashboardRouter);
router.use('/users', userRouter);
