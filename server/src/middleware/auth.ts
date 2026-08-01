import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

export type AuthRequest = Request & {
  auth?: JwtPayload;
};

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const q = req.query.access_token;
  if (typeof q === 'string' && q.length > 0) return q;
  return null;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { profile: true },
    });
    if (!user?.profile || user.profile.id !== payload.profileId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
