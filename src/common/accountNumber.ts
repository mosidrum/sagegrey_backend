import crypto from 'crypto';

const ACCOUNT_NUMBER_LENGTH = 10;
const ACCOUNT_NUMBER_UPPER_BOUND = 10 ** ACCOUNT_NUMBER_LENGTH;

export function generateAccountNumber(): string {
  const randomValue = crypto.randomInt(0, ACCOUNT_NUMBER_UPPER_BOUND);
  return randomValue.toString().padStart(ACCOUNT_NUMBER_LENGTH, '0');
}
