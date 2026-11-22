import type { Product, ValidEnquiry } from '@catalogue/shared';
import type { EmailMessage } from './EmailSender';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

export interface EnquiryEmailOptions {
  salesInbox: string;
  publicWebUrl: string;
}

/** Builds the sales-inbox notification. All user and upstream text is escaped before going into HTML. */
export function buildEnquiryEmail(
  enquiry: ValidEnquiry,
  product: Product,
  options: EnquiryEmailOptions,
): EmailMessage {
  const productUrl = `${options.publicWebUrl}/products/${encodeURIComponent(product.id)}`;
  const price = `${product.price.amount.toFixed(2)} ${product.price.currency}`;
  const rows: [string, string][] = [
    ['Product', `${product.title} (ID ${product.id})`],
    ['Price', price],
    ['Link', productUrl],
    ['Name', enquiry.name],
    ['Email', enquiry.email],
    ['Phone', enquiry.phone ?? '—'],
    ['Message', enquiry.message || '—'],
  ];

  const text = [
    'New product enquiry',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Reply to this email to respond to the customer.',
  ].join('\n');

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" valign="top">${escapeHtml(label)}</th><td style="white-space:pre-wrap">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  const html = `<h2>New product enquiry</h2><table cellpadding="6">${htmlRows}</table><p>Reply to this email to respond to the customer.</p>`;

  return {
    to: options.salesInbox,
    replyTo: enquiry.email,
    subject: `Enquiry: ${product.title}`.replace(/[\r\n]+/g, ' ').slice(0, 150),
    text,
    html,
  };
}
