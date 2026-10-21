const { z } = require('zod');

const password = z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72);

const register = z.object({
  body: z.object({
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    password,
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
  }).strict(),
});

const login = z.object({
  body: z.object({
    email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
    password,
    mfaCode: z.string().regex(/^\d{6}$/).optional(),
  }).strict(),
});

const updateProfile = z.object({
  body: z.object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
  }).strict().refine((body) => Object.keys(body).length > 0),
});

const mfaSetup = z.object({
  body: z.object({ password }).strict(),
});

const mfaVerify = z.object({
  body: z.object({ code: z.string().regex(/^\d{6}$/) }).strict(),
});

module.exports = { register, login, updateProfile, mfaSetup, mfaVerify };