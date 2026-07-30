import { Router } from 'express';
import accountRoutes from './account.routes';
import authRoutes from './auth.routes';
import transactionRoutes from './transaction.routes';
import userRoutes from './user.routes';

const router = Router();

router.get('/', (_req, res) => {
  res.success(undefined, 'Hello World');
});

router.use('/api/auth', authRoutes);
router.use('/api/users', userRoutes);
router.use('/api/accounts', accountRoutes);
router.use('/api/transactions', transactionRoutes);

export default router;
