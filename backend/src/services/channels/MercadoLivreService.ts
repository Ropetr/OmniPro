import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import { ConversationService } from '../ConversationService';
import { Channel } from '../../entities/Channel';
import { AppDataSource } from '../../config/database';

/**
 * MercadoLivre integration via API de Mensagens
 * Docs: https://developers.mercadolivre.com.br/
 */
export class MercadoLivreService {
  private api: AxiosInstance;
  private accessToken: string;

  constructor(private channel: Channel) {
    const config = channel.config || {};
    this.accessToken = config.accessToken || '';
    this.api = axios.create({
      baseURL: 'https://api.mercadolibre.com',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // OAuth: Get authorization URL
  static getAuthUrl(redirectUri: string): string {
    const appId = process.env.MELI_APP_ID;
    return `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  // OAuth: Exchange code for token
  static async exchangeCode(code: string): Promise<{ access_token: string; refresh_token: string; user_id: number }> {
    const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: process.env.MELI_APP_ID,
      client_secret: process.env.MELI_SECRET_KEY,
      code,
      redirect_uri: process.env.MELI_REDIRECT_URI,
    });
    return response.data;
  }

  // Refresh access token
  async refreshAccessToken(): Promise<string> {
    const config = this.channel.config || {};
    try {
      const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
        grant_type: 'refresh_token',
        client_id: process.env.MELI_APP_ID,
        client_secret: process.env.MELI_SECRET_KEY,
        refresh_token: config.refreshToken,
      });

      // Update channel config with new tokens
      const channelRepo = AppDataSource.getRepository(Channel);
      this.channel.config = {
        ...config,
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
      };
      await channelRepo.save(this.channel);

      this.accessToken = response.data.access_token;
      return response.data.access_token;
    } catch (error: any) {
      logger.error('MercadoLivre token refresh failed:', error.message);
      throw error;
    }
  }

  // Reply to a message in an order
  async sendMessage(packId: string, buyerId: number, text: string) {
    try {
      const sellerId = this.channel.config?.sellerId;
      const response = await this.api.post(`/messages/packs/${packId}/sellers/${sellerId}`, {
        from: { user_id: sellerId },
        to: { user_id: buyerId },
        text,
      });
      return response.data;
    } catch (error: any) {
      // Try token refresh
      if (error.response?.status === 401) {
        await this.refreshAccessToken();
        return this.sendMessage(packId, buyerId, text);
      }
      logger.error('MercadoLivre send message failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get messages from a pack/order
  async getMessages(packId: string) {
    try {
      const sellerId = this.channel.config?.sellerId;
      const response = await this.api.get(`/messages/packs/${packId}/sellers/${sellerId}`, {
        params: { tag: 'post_sale' },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        await this.refreshAccessToken();
        return this.getMessages(packId);
      }
      throw error;
    }
  }

  // Get order details
  async getOrder(orderId: string) {
    try {
      const response = await this.api.get(`/orders/${orderId}`);
      return response.data;
    } catch (error: any) {
      logger.error('MercadoLivre get order failed:', error.message);
      throw error;
    }
  }

  // Process incoming notification webhook
  static async handleWebhook(channelId: string, tenantId: string, payload: any) {
    try {
      const { resource, topic, user_id } = payload;

      if (topic === 'messages') {
        // Fetch the message details
        const channel = await AppDataSource.getRepository(Channel).findOne({
          where: { id: channelId },
        });
        if (!channel) return;

        const service = new MercadoLivreService(channel);
        const sellerId = channel.config?.sellerId;

        // Resource format: /messages/packId
        const packId = resource.split('/').pop();
        if (!packId) return;

        const messagesData = await service.getMessages(packId);
        const messages = messagesData.messages || [];

        // Process only unprocessed messages from buyers
        for (const msg of messages) {
          if (msg.from.user_id === sellerId) continue; // Skip our own messages

          const buyerId = msg.from.user_id.toString();
          const text = msg.text || '[Anexo]';
          const messageId = msg.id;

          const conversation = await ConversationService.findOrCreate({
            tenantId,
            channelId,
            contactExternalId: buyerId,
            contactName: `Comprador ML #${buyerId}`,
            source: 'mercadolivre',
          });

          // Check if message already exists (dedup)
          const existing = await AppDataSource.getRepository('Message').findOne({
            where: { externalId: messageId },
          });
          if (existing) continue;

          await ConversationService.addMessage({
            conversationId: conversation.id,
            content: text,
            sender: 'contact',
            externalId: messageId,
            metadata: {
              packId,
              buyerId: msg.from.user_id,
              orderId: messagesData.pack_id,
            },
          });

          // AI handling
          if (conversation.isBot) {
            await ConversationService.processWithAI(conversation.id, tenantId, text);
          }
        }
      }
    } catch (error) {
      logger.error('MercadoLivre webhook processing failed:', error);
    }
  }
}
