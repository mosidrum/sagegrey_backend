import { Router } from 'express';
import * as accountController from '../controllers/account.controller';
import { authenticate } from '../middleware/auth.middleware';
import { accountIdParamValidator } from '../middleware/validators/account.validators';

const router = Router();

router.post('/', authenticate, accountController.createAccount);
router.get('/', authenticate, accountController.listAccounts);
router.get('/:id/balance', authenticate, accountIdParamValidator, accountController.getBalance);
router.post('/:id/lock', authenticate, accountIdParamValidator, accountController.lockAccount);
router.post('/:id/unlock', authenticate, accountIdParamValidator, accountController.unlockAccount);

export default router;
