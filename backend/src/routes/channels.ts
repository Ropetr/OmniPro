import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ChannelService } from '../services/ChannelService';
import { WhatsAppService } from '../services/channels/WhatsAppService';
import { MercadoLivreService } from '../services/channels/MercadoLivreService';
import { EmailService } from '../services/channels/EmailService';

export const channelRouter = Router();

channelRouter.use(authenticate);

// List channels
channelRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const channels = await ChannelService.list(req.tenantId!);
    res.json(channels);
  } catch (error) {
    next(error);
  }
});

// Get channel by ID
channelRouter.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const channel = await ChannelService.getById(req.params.id, req.tenantId!);
    res.json(channel);
  } catch (error) {
    next(error);
  }
});

// Create channel
channelRouter.post('/', authorize('admin', 'supervisor'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, type, config } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });

    const channel = await ChannelService.create(req.tenantId!, { name, type, config });
    res.status(201).json(channel);
  } catch (error) {
    next(error);
  }
});

// Update channel
channelRouter.put('/:id', authorize('admin', 'supervisor'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const channel = await ChannelService.update(req.params.id, req.tenantId!, req.body);
    res.json(channel);
  } catch (error) {
    next(error);
  }
});

// Delete channel
channelRouter.delete('/:id', authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await ChannelService.delete(req.params.id, req.tenantId!);
    res.json({ message: 'Channel deleted' });
  } catch (error) {
    next(error);
  }
});

// === WhatsApp specific routes ===

// Create WhatsApp instance
channelRouter.post('/:id/whatsapp/instance', authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const channel = await ChannelService.getById(req.params.id, req.tenantId!);
    const wa = new WhatsAppService(channel);
    const instanceName = req.body.instanceName || `omnipro_${req.tenantId}`;
    const result = await wa.createInstance(instanceName);

    // Save instance name to channel config
    await ChannelService.update(req.params.id, req.tenantId!, {
      config: { ...channel.config, instanceName },
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get WhatsApp QR code
channelRouter.get('/:id/whatsapp/qrcode', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const channel = await ChannelService.getById(req.params.id, req.tenantId!);
    const wa = new WhatsAppService(channel);
    const result = await wa.getQRCode();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get WhatsApp status
channelRouter.get('/:id/whatsapp/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const channel = await ChannelService.getById(req.params.id, req.tenantId!);
    const wa = new WhatsAppService(channel);
    const result = await wa.getStatus();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// === MercadoLivre OAuth ===

channelRouter.get('/:id/mercadolivre/auth-url', authorize('admin'), async (_req: AuthRequest, res: Response) => {
  const redirectUri = process.env.MELI_REDIRECT_URI || 'http://localhost:3001/api/channels/mercadolivre/callback';
  const url = MercadoLivreService.getAuthUrl(redirectUri);
  res.json({ url });
});

// MercadoLivre OAuth callback (no auth needed - external redirect)
channelRouter.get('/mercadolivre/callback', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Authorization code required' });

    const tokens = await MercadoLivreService.exchangeCode(code as string);
    // Return tokens to frontend to save in channel config
    res.json({
      message: 'MercadoLivre connected successfully',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      userId: tokens.user_id,
    });
  } catch (error) {
    next(error);
  }
});

// === Email - start listening ===

channelRouter.post('/:id/email/start', authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const channel = await ChannelService.getById(req.params.id, req.tenantId!);
    const emailService = new EmailService(channel);
    emailService.startListening(req.tenantId!);
    res.json({ message: 'Email listener started' });
  } catch (error) {
    next(error);
  }
});
