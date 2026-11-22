import type { FastifyBaseLogger } from 'fastify';
import type { AppConfig } from './config';
import type { AppServices } from './app';
import { CachingProductRepository } from './modules/catalogue/CachingProductRepository';
import { CatalogueService } from './modules/catalogue/CatalogueService';
import { FakeStoreProductRepository } from './modules/catalogue/FakeStoreProductRepository';
import { loadFeaturedProductsFile } from './modules/catalogue/FeaturedProducts';
import type { ProductRepository } from './modules/catalogue/ProductRepository';
import { ConsoleEmailSender } from './modules/enquiry/ConsoleEmailSender';
import type { EmailSender } from './modules/enquiry/EmailSender';
import { EnquiryService } from './modules/enquiry/EnquiryService';
import { SmtpEmailSender } from './modules/enquiry/SmtpEmailSender';

/**
 * Composition root: the only place that knows which concrete adapters are in use.
 * Changing the product source or email provider is a change here (plus a new adapter), nowhere else.
 */
export async function createServices(config: AppConfig, logger: FastifyBaseLogger): Promise<AppServices> {
  const products: ProductRepository = new CachingProductRepository(
    new FakeStoreProductRepository(config.fakeStore),
    { ttlMs: config.cacheTtlSeconds * 1000 },
  );

  const featured = await loadFeaturedProductsFile(config.featuredProductsFile);

  const email: EmailSender =
    config.email.provider === 'smtp'
      ? new SmtpEmailSender({ ...config.email.smtp, from: config.email.from })
      : new ConsoleEmailSender(logger);

  return {
    catalogue: new CatalogueService(products, featured, {
      categoryTopRatedLimit: config.categoryTopRatedLimit,
      onMissingFeaturedProduct: (id) => logger.warn({ id }, 'Featured product not found in catalogue'),
    }),
    enquiry: new EnquiryService({
      products,
      email,
      options: { salesInbox: config.email.salesInbox, publicWebUrl: config.publicWebUrl },
      onDeliveryFailure: (err) => logger.error({ err }, 'Enquiry email delivery failed'),
    }),
  };
}
