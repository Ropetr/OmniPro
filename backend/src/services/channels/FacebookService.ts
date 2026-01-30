import axios from 'axios';
import { logger } from '../../utils/logger';
import { ConversationService } from '../ConversationService';
import { Channel } from '../../entities/Channel';

/**
 * Facebook Messenger integration via Meta Graph API
 */
export class FacebookService {
  private accessToken: string;
  private pageId: string;

  constructor(private channel: Channel) {
    const config = channel.config || {};
    this.accessToken = config.pageAccessToken || process.env.META_PAGE_ACCESS_TOKEN || '';
    this.pageId = config.pageId || '';
  }

  // Send text message
  async sendMessage(recipientId: string, text: string) {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/me/messages`,
        {
          recipient: { id: recipientId },
          message: { text },
          messaging_type: 'RESPONSE',
        },
        {
          params: { access_token: this.accessToken },
        }
      );
      return response.data;
    } catch (error: any) {
      logger.error('Facebook send message failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send structured message (buttons, templates)
  async sendTemplate(recipientId: string, template: any) {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/me/messages`,
        {
          recipient: { id: recipientId },
          message: { attachment: { type: 'template', payload: template } },
          messaging_type: 'RESPONSE',
        },
        {
          params: { access_token: this.accessToken },
        }
      );
      return response.data;
    } catch (error: any) {
      logger.error('Facebook send template failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send media attachment
  async sendMedia(recipientId: string, mediaUrl: string, mediaType: 'image' | 'video' | 'audio' | 'file') {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/me/messages`,
        {
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: mediaType,
              payload: { url: mediaUrl, is_reusable: true },
            },
          },
          messaging_type: 'RESPONSE',
        },
        {
          params: { access_token: this.accessToken },
        }
      );
      return response.data;
    } catch (error: any) {
      logger.error('Facebook send media failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // Process incoming webhook
  static async handleWebhook(channelId: string, tenantId: string, payload: any) {
    try {
      const entries = payload.entry || [];

      for (const entry of entries) {
        const messaging = entry.messaging || [];

        for (const event of messaging) {
          // Skip echo messages (sent by us)
          if (event.message?.is_echo) continue;

          if (event.message) {
            const senderId = event.sender?.id;
            const text = event.message?.text || '[Anexo]';
            const messageId = event.message?.mid;

            if (!senderId) continue;

            // Fetch sender profile
            let senderName = senderId;
            try {
              const profileRes = await axios.get(
                `https://graph.facebook.com/v18.0/${senderId}`,
                {
                  params: {
                    fields: 'first_name,last_name,profile_pic',
                    access_token: process.env.META_PAGE_ACCESS_TOKEN,
                  },
                }
              );
              senderName = `${profileRes.data.first_name || ''} ${profileRes.data.last_name || ''}`.trim();
            } catch (e) {
              logger.debug('Could not fetch Facebook profile');
            }

            const conversation = await ConversationService.findOrCreate({
              tenantId,
              channelId,
              contactExternalId: senderId,
              contactName: senderName,
              source: 'facebook',
            });

            const msg = await ConversationService.addMessage({
              conversationId: conversation.id,
              content: text,
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
              await ConversationService.processWithAI(conversation.id, tenantId, text);
            }

            return msg;
          }

          // Handle postbacks (button clicks)
          if (event.postback) {
            const senderId = event.sender?.id;
            const payload = event.postback?.payload;

            if (senderId && payload) {
              const conversation = await ConversationService.findOrCreate({
                tenantId,
                channelId,
                contactExternalId: senderId,
                contactName: senderId,
                source: 'facebook',
              });

              await ConversationService.addMessage({
                conversationId: conversation.id,
                content: `[Botão: ${event.postback.title || payload}]`,
                sender: 'contact',
                metadata: { postback: payload },
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Facebook webhook processing failed:', error);
    }
  }
}
