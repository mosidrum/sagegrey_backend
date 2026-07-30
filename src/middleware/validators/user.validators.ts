import { body } from 'express-validator';
import { runValidation } from './validate';

const PIN_PATTERN = /^\d{4}$/;

export const setPinValidators = [
  body('pin').matches(PIN_PATTERN).withMessage('A valid 4-digit transaction PIN is required.'),
  body('currentPin')
    .optional()
    .matches(PIN_PATTERN)
    .withMessage('A valid 4-digit current transaction PIN is required.'),
  runValidation,
];
