import { z } from 'zod';

/** Rejects CR/LF so values are always safe to place in single-line contexts (logs, email headers). */
const singleLine = (field: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .max(max, `${field} must be at most ${max} characters`)
    .refine((v) => !/[\r\n]/.test(v), `${field} must be a single line`);

/**
 * Enquiry request contract, validated on both client (UX) and server (trust boundary).
 * `website` is a honeypot: humans never see it, naive bots fill it in.
 */
export const enquiryRequestSchema = z.object({
  productId: z.string().trim().min(1, 'Product is required').max(64),
  name: singleLine('Name', 100),
  email: z.string().trim().max(254).pipe(z.email('Enter a valid email address')),
  phone: z
    .string()
    .trim()
    .max(30, 'Phone must be at most 30 characters')
    .regex(/^[+\d\s().-]*$/, 'Phone can only contain digits, spaces and + ( ) - .')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  message: z.string().trim().max(2000, 'Message must be at most 2000 characters').optional(),
  website: z.string().max(200).optional(),
});

export type EnquiryRequest = z.input<typeof enquiryRequestSchema>;
export type ValidEnquiry = z.output<typeof enquiryRequestSchema>;

export interface EnquiryResponse {
  status: 'received';
}
