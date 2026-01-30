import { Router, Request, Response, NextFunction } from 'express';
import { WhatsAppService } from '../services/channels/WhatsAppService';
import { InstagramService } from '../services/channels/InstagramService';
import { FacebookService } from '../services/channels/FacebookService';
import { MercadoLivreService } from '../services/channels/MercadoLivreService';
import { AppDataSource } from '../config/database';
import { Channel } from '../entities/Channel';
import { logger } from '../utils/logger';

export const webhookRouter = Router();

const channelRepo = () => AppDataSource.getRepository(Channel);

// === WhatsApp Evolution API Webhook ===
webhookRouter.post('/whatsapp/:channelId', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const channel = await channelRepo().findOne({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    await WhatsAppService.handleWebhook(channelId, channel.tenantId, req.body);
    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('WhatsApp webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// === Meta (Facebook + Instagram) Webhook Verification ===
webhookRouter.get('/meta/:channelId', (req: Request, res: Response) => {
  const verifyToken = process.env.META_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('Meta webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// === Instagram Webhook ===
webhookRouter.post('/instagram/:channelId', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const channel = await channelRepo().findOne({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    await InstagramService.handleWebhook(channelId, channel.tenantId, req.body);
    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('Instagram webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// === Facebook Messenger Webhook ===
webhookRouter.post('/facebook/:channelId', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const channel = await channelRepo().findOne({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    await FacebookService.handleWebhook(channelId, channel.tenantId, req.body);
    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('Facebook webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// === MercadoLivre Webhook ===
webhookRouter.post('/mercadolivre/:channelId', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const channel = await channelRepo().findOne({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    await MercadoLivreService.handleWebhook(channelId, channel.tenantId, req.body);
    res.json({ status: 'ok' });
  } catch (error) {
    logger.error('MercadoLivre webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// === WebChat Webhook (for widget) ===
webhookRouter.post('/webchat/:channelId', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const channel = await channelRepo().findOne({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const { visitorId, visitorName, visitorEmail, message } = req.body;
    const { ConversationService } = require('../services/ConversationService');

    const conversation = await ConversationService.findOrCreate({
      tenantId: channel.tenantId,
      channelId,
      contactExternalId: visitorId,
      contactName: visitorName || 'Visitante',
      contactEmail: visitorEmail,
      source: 'webchat',
    });

    const msg = await ConversationService.addMessage({
      conversationId: conversation.id,
      content: message,
      sender: 'contact',
    });

    // AI auto-reply if bot is active
    let botReply = null;
    if (conversation.isBot) {
      botReply = await ConversationService.processWithAI(
        conversation.id,
        channel.tenantId,
        message
      );
    }

    res.json({
      conversationId: conversation.id,
      message: msg,
      botReply,
    });
  } catch (error) {
    logger.error('WebChat webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});
