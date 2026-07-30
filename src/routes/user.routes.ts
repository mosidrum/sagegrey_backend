import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { setPinValidators } from '../middleware/validators/user.validators';

const router = Router();

router.put('/pin', authenticate, setPinValidators, userController.setPin);

export default router;
