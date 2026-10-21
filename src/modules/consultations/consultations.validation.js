const { z } = require('zod');

const uuid = z.string().uuid();
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['BOOKED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
});

module.exports = {
  book: z.object({
    body: z.object({ slotId: uuid }).strict(),
    headers: z.object({ 'idempotency-key': z.string().trim().min(8).max(128) }),
  }),
  id: z.object({ params: z.object({ consultationId: uuid }) }),
  list: z.object({ query: pageQuery }),
};