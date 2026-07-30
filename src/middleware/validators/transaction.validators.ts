import { body, param } from 'express-validator';
import { runValidation } from './validate';

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const PIN_PATTERN = /^\d{4}$/;
const ACCOUNT_NUMBER_PATTERN = /^\d{10}$/;

function isPositiveAmount(value: string): boolean {
  const [wholePart = '0', fractionPart = '0'] = value.split('.');
  return BigInt(wholePart) > 0n || BigInt(fractionPart) > 0n;
}

const accountIdParam = param('id').isUUID().withMessage('A valid account id is required.');

const amountBody = body('amount')
  .matches(AMOUNT_PATTERN)
  .withMessage('A valid amount greater than zero is required.')
  .custom(isPositiveAmount)
  .withMessage('A valid amount greater than zero is required.');

const pinBody = body('pin')
  .matches(PIN_PATTERN)
  .withMessage('A valid 4-digit transaction PIN is required.');

const descriptionBody = body('description')
  .optional()
  .trim()
  .isLength({ max: 255 })
  .withMessage('Description must be at most 255 characters long.');

export const fundValidators = [accountIdParam, amountBody, descriptionBody, runValidation];

export const withdrawValidators = [
  accountIdParam,
  amountBody,
  pinBody,
  descriptionBody,
  runValidation,
];

export const transferValidators = [
  accountIdParam,
  amountBody,
  pinBody,
  descriptionBody,
  body('destinationAccountNumber')
    .matches(ACCOUNT_NUMBER_PATTERN)
    .withMessage('A valid 10-digit destination account number is required.'),
  runValidation,
];
