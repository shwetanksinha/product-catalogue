export interface EmailMessage {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Port for outbound email. Swap providers (SMTP, AWS SES, SendGrid...) by adding an adapter and
 * selecting it in the composition root; callers never change.
 */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
