import { param } from 'express-validator';
import { runValidation } from './validate';

export const accountIdParamValidator = [
  param('id').isInt({ min: 1 }).withMessage('A valid account id is required.').toInt(),
  runValidation,
];
