import { Router } from 'express';
import authRoutes from './auth.routes';

const router = Router();

router.get('/', (_req, res) => {
  res.success(undefined, 'Hello World');
});

router.use('/api/auth', authRoutes);

export default router;
