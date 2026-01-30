import nodemailer from 'nodemailer';
import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import { logger } from '../../utils/logger';
import { ConversationService } from '../ConversationService';
import { Channel } from '../../entities/Channel';

/**
 * Email integration via IMAP (receive) + SMTP (send)
 */
export class EmailService {
  private channel: Channel;

  constructor(channel: Channel) {
    this.channel = channel;
  }

  private getSmtpTransport() {
    const config = this.channel.config || {};
    return nodemailer.createTransport({
      host: config.smtpHost || process.env.EMAIL_SMTP_HOST,
      port: config.smtpPort || parseInt(process.env.EMAIL_SMTP_PORT || '587'),
      secure: config.smtpPort === 465,
      auth: {
        user: config.emailUser || process.env.EMAIL_USER,
        pass: config.emailPassword || process.env.EMAIL_PASSWORD,
      },
    });
  }

  // Send email reply
  async sendEmail(to: string, subject: string, html: string, inReplyTo?: string) {
    try {
      const transport = this.getSmtpTransport();
      const config = this.channel.config || {};
      const from = config.emailUser || process.env.EMAIL_USER;

      const result = await transport.sendMail({
        from: `"${config.senderName || 'Suporte'}" <${from}>`,
        to,
        subject,
        html,
        ...(inReplyTo && {
          inReplyTo,
          references: inReplyTo,
        }),
      });

      logger.info(`Email sent to ${to}: ${result.messageId}`);
      return result;
    } catch (error: any) {
      logger.error('Email send failed:', error.message);
      throw error;
    }
  }

  // Start IMAP listener for incoming emails
  startListening(tenantId: string) {
    const config = this.channel.config || {};
    const channelId = this.channel.id;

    const imap = new Imap({
      user: config.emailUser || process.env.EMAIL_USER!,
      password: config.emailPassword || process.env.EMAIL_PASSWORD!,
      host: config.imapHost || process.env.EMAIL_IMAP_HOST!,
      port: config.imapPort || parseInt(process.env.EMAIL_IMAP_PORT || '993'),
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.once('ready', () => {
      logger.info(`IMAP connected for channel ${channelId}`);

      imap.openBox('INBOX', false, (err) => {
        if (err) {
          logger.error('IMAP open inbox failed:', err);
          return;
        }

        // Listen for new emails
        imap.on('mail', () => {
          this.fetchNewEmails(imap, channelId, tenantId);
        });

        // Initial fetch of unseen emails
        this.fetchNewEmails(imap, channelId, tenantId);
      });
    });

    imap.once('error', (err: Error) => {
      logger.error('IMAP error:', err);
      // Reconnect after 30 seconds
      setTimeout(() => this.startListening(tenantId), 30000);
    });

    imap.once('end', () => {
      logger.info('IMAP connection ended, reconnecting...');
      setTimeout(() => this.startListening(tenantId), 5000);
    });

    imap.connect();
    return imap;
  }

  private fetchNewEmails(imap: Imap, channelId: string, tenantId: string) {
    imap.search(['UNSEEN'], (err, results) => {
      if (err || !results || results.length === 0) return;

      const fetch = imap.fetch(results, { bodies: '', markSeen: true });

      fetch.on('message', (msg) => {
        msg.on('body', (stream) => {
          simpleParser(stream as any, async (parseErr, parsed) => {
            if (parseErr) {
              logger.error('Email parse error:', parseErr);
              return;
            }

            try {
              const fromAddress = parsed.from?.value?.[0]?.address || 'unknown';
              const fromName = parsed.from?.value?.[0]?.name || fromAddress;
              const subject = parsed.subject || '(Sem assunto)';
              const textContent = parsed.text || parsed.html || '';
              const messageId = parsed.messageId || '';

              const conversation = await ConversationService.findOrCreate({
                tenantId,
                channelId,
                contactExternalId: fromAddress,
                contactName: fromName,
                contactEmail: fromAddress,
                source: 'email',
              });

              // Update subject
              if (subject) {
                const { AppDataSource } = require('../../config/database');
                const convRepo = AppDataSource.getRepository('Conversation');
                await convRepo.update(conversation.id, { subject });
              }

              await ConversationService.addMessage({
                conversationId: conversation.id,
                content: textContent.substring(0, 10000), // Limit content size
                sender: 'contact',
                externalId: messageId,
                type: 'text',
                metadata: {
                  subject,
                  from: fromAddress,
                  to: parsed.to?.value?.map((v: any) => v.address),
                  inReplyTo: parsed.inReplyTo,
                },
                attachments: parsed.attachments?.map((att) => ({
                  name: att.filename || 'attachment',
                  type: att.contentType,
                  size: att.size,
                  url: '', // Would need to save attachment to storage
                })),
              });

              // AI handling
              if (conversation.isBot) {
                await ConversationService.processWithAI(conversation.id, tenantId, textContent);
              }
            } catch (processErr) {
              logger.error('Email processing failed:', processErr);
            }
          });
        });
      });
    });
  }
}
