import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const rawOrigins = process.env.CORS_ORIGIN?.trim();
const allowedOrigins = rawOrigins
  ? rawOrigins.split(',').map((origin) => origin.trim())
  : undefined;

export const securityHeaders = helmet();

export const corsMiddleware = cors({ origin: allowedOrigins ?? true });

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
