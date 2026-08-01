import jwt from 'jsonwebtoken';
import { env } from './env.js';

export type JwtPayload = {
  userId: string;
  profileId: string;
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
