import type { ValidEnquiry } from '@catalogue/shared';
import { EmailDeliveryError, NotFoundError } from '../../shared/errors';
import type { ProductRepository } from '../catalogue/ProductRepository';
import type { EmailSender } from './EmailSender';
import { buildEnquiryEmail, type EnquiryEmailOptions } from './enquiryEmail';

export type EnquiryOutcome = 'sent' | 'discarded-as-spam';

export interface EnquiryServiceDeps {
  products: ProductRepository;
  email: EmailSender;
  options: EnquiryEmailOptions;
  onDeliveryFailure?: (error: unknown) => void;
}

export class EnquiryService {
  constructor(private readonly deps: EnquiryServiceDeps) {}

  async submit(enquiry: ValidEnquiry): Promise<EnquiryOutcome> {
    // Honeypot filled in: pretend success so bots learn nothing, but send nothing.
    if (enquiry.website) return 'discarded-as-spam';

    // Look the product up server-side: the email must reflect real catalogue data, not client input.
    const product = await this.deps.products.getProduct(enquiry.productId);
    if (!product) throw new NotFoundError(`Product "${enquiry.productId}" was not found`);

    const message = buildEnquiryEmail(enquiry, product, this.deps.options);
    try {
      await this.deps.email.send(message);
    } catch (error) {
      this.deps.onDeliveryFailure?.(error);
      throw new EmailDeliveryError('We could not send your enquiry. Please try again shortly.', {
        cause: error,
      });
    }
    return 'sent';
  }
}
