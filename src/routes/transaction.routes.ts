import { Router } from 'express';
import * as transactionController from '../controllers/transaction.controller';
import { authenticate } from '../middleware/auth.middleware';
import { idempotency } from '../middleware/idempotency.middleware';
import { accountIdParamValidator } from '../middleware/validators/account.validators';
import {
  fundValidators,
  transferValidators,
  withdrawValidators,
} from '../middleware/validators/transaction.validators';

const router = Router();

router.post('/:id/fund', authenticate, idempotency, fundValidators, transactionController.fund);
router.post(
  '/:id/withdraw',
  authenticate,
  idempotency,
  withdrawValidators,
  transactionController.withdraw,
);
router.post(
  '/:id/transfer',
  authenticate,
  idempotency,
  transferValidators,
  transactionController.transfer,
);
router.get('/:id', authenticate, accountIdParamValidator, transactionController.listForAccount);

export default router;
