import { param } from 'express-validator';
import { runValidation } from './validate';

export const accountIdParamValidator = [
  param('id').isUUID().withMessage('A valid account id is required.'),
  runValidation,
];
