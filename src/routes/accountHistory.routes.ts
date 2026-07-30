import { Router } from 'express';
import * as accountHistoryController from '../controllers/accountHistory.controller';
import { authenticate } from '../middleware/auth.middleware';
import { accountIdParamValidator } from '../middleware/validators/account.validators';

const router = Router();

router.get('/:id', authenticate, accountIdParamValidator, accountHistoryController.listForAccount);

export default router;
