import axios from 'axios';
import { logger } from '../../utils/logger';
import { ConversationService } from '../ConversationService';
import { Channel } from '../../entities/Channel';

/**
 * Instagram integration via Meta Graph API
 * Handles Instagram Direct Messages via Instagram Messaging API
 */
export class InstagramService {
  private accessToken: string;
  private pageId: string;

  constructor(private channel: Channel) {
    const config = channel.config || {};
    this.accessToken = config.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN || '';
    this.pageId = config.pageId || '';
  }

  // Send message via Instagram
  async sendMessage(recipientId: string, text: string) {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${this.pageId}/messages`,
        {
          recipient: { id: recipientId },
          message: { text },
        },
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      return response.data;
    } catch (error: any) {
      logger.error('Instagram send message failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send media
  async sendMedia(recipientId: string, mediaUrl: string, mediaType: 'image' | 'video') {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${this.pageId}/messages`,
        {
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: mediaType,
              payload: { url: mediaUrl },
            },
          },
        },
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      return response.data;
    } catch (error: any) {
      logger.error('Instagram send media failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Process incoming webhook from Meta
  static async handleWebhook(channelId: string, tenantId: string, payload: any) {
    try {
      const entries = payload.entry || [];

      for (const entry of entries) {
        const messaging = entry.messaging || [];

        for (const event of messaging) {
          if (event.message) {
            const senderId = event.sender?.id;
            const messageText = event.message?.text || '[Mídia]';
            const messageId = event.message?.mid;

            if (!senderId) continue;

            // Get sender info
            let senderName = senderId;
            try {
              const profileRes = await axios.get(
                `https://graph.facebook.com/v18.0/${senderId}`,
                {
                  params: {
                    fields: 'name,profile_pic',
                    access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
                  },
                }
              );
              senderName = profileRes.data.name || senderId;
            } catch (e) {
              logger.debug('Could not fetch Instagram profile');
            }

            // Find or create conversation
            const conversation = await ConversationService.findOrCreate({
              tenantId,
              channelId,
              contactExternalId: senderId,
              contactName: senderName,
              source: 'instagram',
            });

            // Add message
            const msg = await ConversationService.addMessage({
              conversationId: conversation.id,
              content: messageText,
              sender: 'contact',
              externalId: messageId,
              type: event.message?.attachments ? 'image' : 'text',
              attachments: event.message?.attachments?.map((a: any) => ({
                url: a.payload?.url,
                type: a.type,
                name: a.type,
                size: 0,
              })),
            });

            // AI handling
            if (conversation.isBot) {
              await ConversationService.processWithAI(conversation.id, tenantId, messageText);
            }

            return msg;
          }
        }
      }
    } catch (error) {
      logger.error('Instagram webhook processing failed:', error);
    }
  }
}
