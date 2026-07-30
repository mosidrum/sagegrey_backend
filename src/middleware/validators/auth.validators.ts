import { body } from 'express-validator';
import { runValidation } from './validate';

export const signupValidators = [
  body('fullName').trim().notEmpty().withMessage('A full name is required.'),
  body('email').trim().toLowerCase().isEmail().withMessage('A valid email address is required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.'),
  runValidation,
];

export const loginValidators = [
  body('email').trim().toLowerCase().isEmail().withMessage('A valid email address is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
  runValidation,
];
