import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loginValidators, signupValidators } from '../middleware/validators/auth.validators';

const router = Router();

router.post('/signup', signupValidators, authController.signup);
router.post('/login', loginValidators, authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
