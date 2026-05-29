import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ success: false, error: { code: 'RATE_LIMIT', message: 'Too many login attempts, please try again in 5 minutes' } });
  },
});

const loginSchema = z.object({
  password: z.string().min(1),
});

router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
  const { password } = req.body;

  const valid = await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);
  if (!valid) {
    res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid password' } });
    return;
  }

  const token = jwt.sign({ admin: true }, env.JWT_SECRET, { expiresIn: '24h' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.json({ success: true, data: { token, message: 'Logged in' } });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token', {
    path: '/',
    secure: true,
    sameSite: 'none',
  });
  res.json({ success: true, data: { message: 'Logged out' } });
});

router.get('/me', authenticate, (_req, res) => {
  res.json({ success: true, data: { admin: true } });
});

export default router;
