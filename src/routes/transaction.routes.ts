import { Router } from 'express';
import * as transactionController from '../controllers/transaction.controller';
import { authenticate } from '../middleware/auth.middleware';
import { accountIdParamValidator } from '../middleware/validators/account.validators';
import {
  fundValidators,
  transferValidators,
  withdrawValidators,
} from '../middleware/validators/transaction.validators';

const router = Router();

router.post('/:id/fund', authenticate, fundValidators, transactionController.fund);
router.post('/:id/withdraw', authenticate, withdrawValidators, transactionController.withdraw);
router.post('/:id/transfer', authenticate, transferValidators, transactionController.transfer);
router.get(
  '/:id/transactions',
  authenticate,
  accountIdParamValidator,
  transactionController.listForAccount,
);

export default router;
