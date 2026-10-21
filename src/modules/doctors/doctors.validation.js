const { z } = require('zod');

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  name: z.string().trim().max(120).optional(),
  specialization: z.string().trim().max(120).optional(),
});

module.exports = {
  search: z.object({ query: pagination }),
  id: z.object({ params: z.object({ doctorId: uuid }) }),
  slots: z.object({
    params: z.object({ doctorId: uuid }),
    query: z.object({ date: isoDate }),
  }),
  profile: z.object({
    body: z.object({
      specialization: z.string().trim().min(2).max(120),
      bio: z.string().trim().max(5000).nullable().optional(),
      licenseNumber: z.string().trim().min(3).max(100),
    }).strict(),
  }),
};