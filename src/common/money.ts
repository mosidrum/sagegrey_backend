import { AppError } from './errors';
import { HTTP } from './http';

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

export function toMinorUnits(amount: string): bigint {
  if (!AMOUNT_PATTERN.test(amount)) {
    throw new AppError(HTTP.BAD_REQUEST, 'A valid amount greater than zero is required.');
  }

  const [wholePart = '0', fractionPart = ''] = amount.split('.');
  const minorUnits = BigInt(wholePart) * 100n + BigInt(fractionPart.padEnd(2, '0'));

  if (minorUnits <= 0n) {
    throw new AppError(HTTP.BAD_REQUEST, 'A valid amount greater than zero is required.');
  }

  return minorUnits;
}

export function fromMinorUnits(minorAmount: string): string {
  const minorUnits = BigInt(minorAmount);
  const wholePart = minorUnits / 100n;
  const fractionPart = (minorUnits % 100n).toString().padStart(2, '0');
  return `${wholePart}.${fractionPart}`;
}
