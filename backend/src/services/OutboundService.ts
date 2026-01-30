import { AppDataSource } from '../config/database';
import { Conversation } from '../entities/Conversation';
import { Channel } from '../entities/Channel';
import { Message } from '../entities/Message';
import { WhatsAppService } from './channels/WhatsAppService';
import { InstagramService } from './channels/InstagramService';
import { FacebookService } from './channels/FacebookService';
import { MercadoLivreService } from './channels/MercadoLivreService';
import { EmailService } from './channels/EmailService';
import { getIO } from '../config/socket';
import { logger } from '../utils/logger';

const convRepo = () => AppDataSource.getRepository(Conversation);
const channelRepo = () => AppDataSource.getRepository(Channel);
const msgRepo = () => AppDataSource.getRepository(Message);

/**
 * Routes agent/bot replies back to the customer's original channel.
 * This is the critical bridge between the dashboard and external platforms.
 */
export class OutboundService {
  /**
   * Send a message to the customer via their original channel.
   * Called after an agent or bot message is saved to the database.
   */
  static async sendToChannel(conversationId: string, messageId: string): Promise<{
    sent: boolean;
    externalId?: string;
    error?: string;
  }> {
    try {
      const conversation = await convRepo().findOne({
        where: { id: conversationId },
        relations: ['contact', 'channel'],
      });
      if (!conversation) return { sent: false, error: 'Conversation not found' };

      const message = await msgRepo().findOne({ where: { id: messageId } });
      if (!message) return { sent: false, error: 'Message not found' };

      const channel = conversation.channel;
      const contact = conversation.contact;
      const externalId = contact.externalId;

      if (!externalId) {
        logger.warn(`No external ID for contact ${contact.id}, cannot send outbound`);
        return { sent: false, error: 'Contact has no external ID' };
      }

      let result: any;

      switch (channel.type) {
        case 'whatsapp':
          result = await this.sendWhatsApp(channel, externalId, message);
          break;

        case 'instagram':
          result = await this.sendInstagram(channel, externalId, message);
          break;

        case 'facebook':
          result = await this.sendFacebook(channel, externalId, message);
          break;

        case 'mercadolivre':
          result = await this.sendMercadoLivre(channel, conversation, message);
          break;

        case 'email':
          result = await this.sendEmail(channel, contact, conversation, message);
          break;

        case 'webchat':
          result = await this.sendWebchat(conversation, message);
          break;

        default:
          return { sent: false, error: `Unknown channel type: ${channel.type}` };
      }

      // Update message status
      if (result?.sent) {
        await msgRepo().update(messageId, {
          status: 'delivered',
          externalId: result.externalId || undefined,
        });
        logger.info(`Outbound message ${messageId} sent via ${channel.type} to ${externalId}`);
      } else {
        await msgRepo().update(messageId, { status: 'failed' });
        logger.error(`Outbound message ${messageId} failed: ${result?.error}`);
      }

      return result;
    } catch (error: any) {
      logger.error(`OutboundService error for message ${messageId}:`, error.message);
      await msgRepo().update(messageId, { status: 'failed' });
      return { sent: false, error: error.message };
    }
  }

  // === Channel-specific senders ===

  private static async sendWhatsApp(channel: Channel, phone: string, message: Message) {
    try {
      const wa = new WhatsAppService(channel);

      if (message.type === 'text') {
        const result = await wa.sendText(phone, message.content);
        return { sent: true, externalId: result?.key?.id };
      }

      if (['image', 'video', 'audio', 'file'].includes(message.type) && message.attachments?.[0]) {
        const att = message.attachments[0];
        const result = await wa.sendMedia(phone, att.url, message.content, message.type as any);
        return { sent: true, externalId: result?.key?.id };
      }

      // Default to text
      const result = await wa.sendText(phone, message.content);
      return { sent: true, externalId: result?.key?.id };
    } catch (error: any) {
      return { sent: false, error: error.message };
    }
  }

  private static async sendInstagram(channel: Channel, recipientId: string, message: Message) {
    try {
      const ig = new InstagramService(channel);

      if (message.type === 'text') {
        const result = await ig.sendMessage(recipientId, message.content);
        return { sent: true, externalId: result?.message_id };
      }

      if (['image', 'video'].includes(message.type) && message.attachments?.[0]) {
        const att = message.attachments[0];
        const result = await ig.sendMedia(recipientId, att.url, message.type as any);
        return { sent: true, externalId: result?.message_id };
      }

      const result = await ig.sendMessage(recipientId, message.content);
      return { sent: true, externalId: result?.message_id };
    } catch (error: any) {
      return { sent: false, error: error.message };
    }
  }

  private static async sendFacebook(channel: Channel, recipientId: string, message: Message) {
    try {
      const fb = new FacebookService(channel);

      if (message.type === 'text') {
        const result = await fb.sendMessage(recipientId, message.content);
        return { sent: true, externalId: result?.message_id };
      }

      if (['image', 'video', 'audio', 'file'].includes(message.type) && message.attachments?.[0]) {
        const att = message.attachments[0];
        const result = await fb.sendMedia(recipientId, att.url, message.type as any);
        return { sent: true, externalId: result?.message_id };
      }

      const result = await fb.sendMessage(recipientId, message.content);
      return { sent: true, externalId: result?.message_id };
    } catch (error: any) {
      return { sent: false, error: error.message };
    }
  }

  private static async sendMercadoLivre(channel: Channel, conversation: Conversation, message: Message) {
    try {
      const ml = new MercadoLivreService(channel);
      const packId = conversation.metadata?.packId;
      const buyerId = conversation.contact?.externalId;

      if (!packId || !buyerId) {
        return { sent: false, error: 'Missing packId or buyerId for MercadoLivre' };
      }

      const result = await ml.sendMessage(packId, parseInt(buyerId), message.content);
      return { sent: true, externalId: result?.id };
    } catch (error: any) {
      return { sent: false, error: error.message };
    }
  }

  private static async sendEmail(channel: Channel, contact: any, conversation: Conversation, message: Message) {
    try {
      if (!contact.email) {
        return { sent: false, error: 'Contact has no email address' };
      }

      const emailService = new EmailService(channel);
      const subject = conversation.subject || 'Re: Atendimento';

      // Find the original email messageId for threading
      const originalMsg = await msgRepo().findOne({
        where: { conversationId: conversation.id, sender: 'contact' as any },
        order: { createdAt: 'DESC' },
      });
      const inReplyTo = originalMsg?.metadata?.messageId;

      const result = await emailService.sendEmail(
        contact.email,
        subject,
        `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          ${message.content.replace(/\n/g, '<br>')}
          <br><br>
          <small style="color: #999;">— Equipe de Suporte</small>
        </div>`,
        inReplyTo,
      );

      return { sent: true, externalId: result?.messageId };
    } catch (error: any) {
      return { sent: false, error: error.message };
    }
  }

  private static async sendWebchat(conversation: Conversation, message: Message) {
    try {
      const io = getIO();
      // Broadcast to visitor via Socket.IO
      io.of('/visitors').to(`visitor:${conversation.contactId}`).emit('new_message', {
        id: message.id,
        content: message.content,
        type: message.type,
        sender: message.sender,
        createdAt: message.createdAt,
      });

      return { sent: true };
    } catch (error: any) {
      return { sent: false, error: error.message };
    }
  }
}
