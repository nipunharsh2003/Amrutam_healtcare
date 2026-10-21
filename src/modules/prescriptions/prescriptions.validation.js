const { z } = require('zod');

const uuid = z.string().uuid();
const details = z.object({
  diagnosis: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(5000).optional(),
  medications: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    dosage: z.string().trim().min(1).max(200),
    frequency: z.string().trim().min(1).max(200),
    duration: z.string().trim().min(1).max(200),
  }).strict()).max(50),
}).strict();

module.exports = {
  create: z.object({
    params: z.object({ consultationId: uuid }),
    body: z.object({ details }),
  }),
  list: z.object({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }),
  }),
};