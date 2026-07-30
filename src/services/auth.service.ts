import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../common/errors';
import { HTTP } from '../common/http';
import logger from '../common/logger';
import { AuthUser, SafeUser, User } from '../models/user.model';
import * as userRepository from '../repositories/user.repository';

const SALT_ROUNDS = 10;
const UNIQUE_VIOLATION = '23505';
const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'];

function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    created_at: user.created_at,
  };
}

function generateToken(user: User): string {
  return jwt.sign({ email: user.email, name: user.full_name }, JWT_SECRET, {
    subject: user.id,
    expiresIn: JWT_EXPIRES_IN,
  });
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

  try {
    const user = await userRepository.create({
      full_name: fullName,
      email,
      password_hash: passwordHash,
    });

    if (!user) {
      throw new AppError(HTTP.INTERNAL_SERVER_ERROR, 'Failed to create user');
    }

    logger.INFO('User registered', { userId: user.id });
    return { user: toSafeUser(user), token: generateToken(user) };
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

  logger.INFO('User logged in', { userId: user.id });
  return { user: toSafeUser(user), token: generateToken(user) };
}

export function logout(userId: string): void {
  logger.INFO('User logged out', { userId });
}

export function verifyToken(token: string): AuthUser {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      typeof decoded.sub !== 'string' ||
      typeof decoded.email !== 'string' ||
      typeof decoded.name !== 'string'
    ) {
      throw new Error('Malformed token payload');
    }

    return { id: decoded.sub, email: decoded.email, full_name: decoded.name };
  } catch {
    logger.WARN('Failed authentication: invalid or expired token');
    throw new AppError(HTTP.UNAUTHORIZED, 'Invalid or expired token');
  }
}
