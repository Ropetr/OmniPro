import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import { ConversationService } from '../ConversationService';
import { Channel } from '../../entities/Channel';

/**
 * WhatsApp integration via Evolution API (unofficial)
 * Docs: https://doc.evolution-api.com/
 */
export class WhatsAppService {
  private api: AxiosInstance;

  constructor(
    private channel: Channel,
  ) {
    const config = channel.config || {};
    this.api = axios.create({
      baseURL: config.evolutionApiUrl || process.env.EVOLUTION_API_URL || 'http://localhost:8080',
      headers: {
        'apikey': config.apiKey || process.env.EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
    });
  }

  // Create a new WhatsApp instance
  async createInstance(instanceName: string) {
    try {
      const response = await this.api.post('/instance/create', {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      });
      logger.info(`WhatsApp instance created: ${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to create WhatsApp instance:', error.message);
      throw error;
    }
  }

  // Get QR code for connecting
  async getQRCode() {
    const instanceName = this.channel.config?.instanceName;
    if (!instanceName) throw new Error('Instance name not configured');

    try {
      const response = await this.api.get(`/instance/connect/${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get QR code:', error.message);
      throw error;
    }
  }

  // Check connection status
  async getStatus() {
    const instanceName = this.channel.config?.instanceName;
    try {
      const response = await this.api.get(`/instance/connectionState/${instanceName}`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get status:', error.message);
      throw error;
    }
  }

  // Send text message
  async sendText(to: string, text: string) {
    const instanceName = this.channel.config?.instanceName;
    try {
      const response = await this.api.post(`/message/sendText/${instanceName}`, {
        number: to,
        text,
      });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to send WhatsApp message:', error.message);
      throw error;
    }
  }

  // Send media message
  async sendMedia(to: string, mediaUrl: string, caption: string, mediaType: 'image' | 'video' | 'audio' | 'document') {
    const instanceName = this.channel.config?.instanceName;
    try {
      const response = await this.api.post(`/message/sendMedia/${instanceName}`, {
        number: to,
        mediatype: mediaType,
        media: mediaUrl,
        caption,
      });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to send WhatsApp media:', error.message);
      throw error;
    }
  }

  // Process incoming webhook from Evolution API
  static async handleWebhook(channelId: string, tenantId: string, payload: any) {
    try {
      const event = payload.event;

      if (event === 'messages.upsert') {
        const message = payload.data;
        if (!message || message.key?.fromMe) return;

        const remoteJid = message.key?.remoteJid;
        if (!remoteJid) return;

        const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
        const pushName = message.pushName || phone;
        const body = message.message?.conversation
          || message.message?.extendedTextMessage?.text
          || message.message?.imageMessage?.caption
          || '[Mídia]';

        // Find or create conversation
        const conversation = await ConversationService.findOrCreate({
          tenantId,
          channelId,
          contactExternalId: phone,
          contactName: pushName,
          contactPhone: phone,
          source: 'whatsapp',
        });

        // Add message
        const msg = await ConversationService.addMessage({
          conversationId: conversation.id,
          content: body,
          sender: 'contact',
          externalId: message.key?.id,
          type: message.message?.imageMessage ? 'image' :
                message.message?.audioMessage ? 'audio' :
                message.message?.videoMessage ? 'video' :
                message.message?.documentMessage ? 'file' : 'text',
        });

        // Check if AI should respond
        if (conversation.isBot) {
          await ConversationService.processWithAI(conversation.id, tenantId, body);
        }

        return msg;
      }

      if (event === 'connection.update') {
        logger.info(`WhatsApp connection update for channel ${channelId}:`, payload.data);
      }
    } catch (error) {
      logger.error('WhatsApp webhook processing failed:', error);
    }
  }
}
