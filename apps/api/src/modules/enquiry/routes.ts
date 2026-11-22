import type { FastifyInstance } from 'fastify';
import { enquiryRequestSchema, type EnquiryResponse } from '@catalogue/shared';
import { toValidationError } from '../../shared/validation';
import type { EnquiryService } from './EnquiryService';

export function enquiryRoutes(service: EnquiryService) {
  return async function register(app: FastifyInstance): Promise<void> {
    app.post('/enquiries', async (req, reply): Promise<EnquiryResponse> => {
      const parsed = enquiryRequestSchema.safeParse(req.body);
      if (!parsed.success) throw toValidationError(parsed.error, 'Please check the highlighted fields');

      const outcome = await service.submit(parsed.data);
      req.log.info({ productId: parsed.data.productId, outcome }, 'Enquiry processed');
      // 202: the contract stays valid when delivery moves to a queue later.
      reply.code(202);
      return { status: 'received' };
    });
  };
}
