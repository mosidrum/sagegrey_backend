import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AppError } from '../common/errors';
import { HTTP } from '../common/http';
import logger from '../common/logger';
import { SafeUser, User } from '../models/user.model';
import * as userRepository from '../repositories/user.repository';

const SALT_ROUNDS = 10;
const UNIQUE_VIOLATION = '23505';

function toSafeUser(user: User): SafeUser {
  return { id: user.id, email: user.email, full_name: user.full_name, created_at: user.created_at };
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === UNIQUE_VIOLATION
  );
}

export async function signup(
  fullName: string,
  email: string,
  password: string,
): Promise<{ user: SafeUser; token: string }> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const token = generateToken();

  try {
    const user = await userRepository.create({
      full_name: fullName,
      email,
      password_hash: passwordHash,
      token,
    });

    if (!user) {
      throw new AppError(HTTP.INTERNAL_SERVER_ERROR, 'Failed to create user');
    }

    logger.INFO('User registered', { userId: user.id });
    return { user: toSafeUser(user), token };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(HTTP.CONFLICT, 'Email is already registered');
    }
    throw error;
  }
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: SafeUser; token: string }> {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    logger.WARN('Failed login attempt: email not found', { email });
    throw new AppError(HTTP.UNAUTHORIZED, 'Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    logger.WARN('Failed login attempt: incorrect password', { userId: user.id });
    throw new AppError(HTTP.UNAUTHORIZED, 'Invalid email or password');
  }

  const token = generateToken();
  await userRepository.update(user.id, { token });

  logger.INFO('User logged in', { userId: user.id });
  return { user: toSafeUser(user), token };
}

export async function logout(userId: number): Promise<void> {
  await userRepository.update(userId, { token: null });
  logger.INFO('User logged out', { userId });
}

export async function findByToken(token: string): Promise<SafeUser | undefined> {
  const user = await userRepository.findByToken(token);
  return user ? toSafeUser(user) : undefined;
}
