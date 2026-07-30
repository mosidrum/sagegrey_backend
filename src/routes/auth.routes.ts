import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
