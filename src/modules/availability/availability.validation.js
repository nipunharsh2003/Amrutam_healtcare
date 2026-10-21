const { z } = require('zod');

module.exports = {
  create: z.object({
    body: z.object({
      doctorId: z.string().uuid(),
      startsAt: z.string().datetime({ offset: true }),
      endsAt: z.string().datetime({ offset: true }),
    }).strict().refine((body) => new Date(body.startsAt) > new Date() && new Date(body.startsAt) < new Date(body.endsAt)),
  }),
};