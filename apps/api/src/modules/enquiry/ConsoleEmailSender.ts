import type { FastifyBaseLogger } from 'fastify';
import type { EmailMessage, EmailSender } from './EmailSender';

/** Development fallback when no SMTP server is running: logs the email instead of sending it. */
export class ConsoleEmailSender implements EmailSender {
  constructor(private readonly logger: FastifyBaseLogger) {}

  send(message: EmailMessage): Promise<void> {
    this.logger.info(
      { to: message.to, replyTo: message.replyTo, subject: message.subject, text: message.text },
      'Email (console provider, not delivered)',
    );
    return Promise.resolve();
  }
}
