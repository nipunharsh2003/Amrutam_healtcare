const { z } = require('zod');

const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

module.exports = {
  query: z.object({ query: pageQuery.refine((query) => !query.from || !query.to || new Date(query.from) <= new Date(query.to)) }),
  role: z.object({
    params: z.object({ userId: z.string().uuid() }),
    body: z.object({ role: z.enum(['PATIENT', 'DOCTOR', 'ADMIN']) }).strict(),
  }),
  doctorVerification: z.object({
    params: z.object({ doctorId: z.string().uuid() }),
    body: z.object({ verificationStatus: z.enum(['VERIFIED', 'REJECTED']) }).strict(),
  }),
};