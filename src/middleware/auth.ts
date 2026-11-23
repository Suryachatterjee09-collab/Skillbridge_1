import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { profiles } from '../db/schema.ts';

export const ADMIN_EMAIL = 'bantichatterjee09@gmail.com';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  profile?: typeof profiles.$inferSelect;
}

export function sanitizeUsername(raw: string, uidSuffix: string): string {
  const base = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 18);
  const suffix = uidSuffix.slice(0, 5).toLowerCase();
  return `${base || 'student'}_${suffix}`;
}

export async function getOrCreateProfile(decodedToken: DecodedIdToken) {
  const uid = decodedToken.uid;
  const email = decodedToken.email || `${uid}@student.skillbridge.local`;
  const isOwnerAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  try {
    const existing = await db.select().from(profiles).where(eq(profiles.uid, uid)).limit(1);
    if (existing.length > 0) {
      const current = existing[0];
      const nextRole = isOwnerAdmin ? 'admin' : current.role;
      const [updated] = await db
        .update(profiles)
        .set({
          email,
          role: nextRole,
          lastActiveAt: new Date(),
        })
        .where(eq(profiles.id, current.id))
        .returning();
      return updated;
    }

    const displayName = decodedToken.name || email.split('@')[0] || 'Student';
    const username = sanitizeUsername(displayName, uid);
    const avatarUrl = decodedToken.picture || '';

    const [inserted] = await db
      .insert(profiles)
      .values({
        uid,
        email,
        fullName: displayName,
        username,
        avatarUrl,
        role: isOwnerAdmin ? 'admin' : 'student',
        bio: 'Engineering student exploring peer-to-peer skill exchange on SkillBridge.',
      })
      .onConflictDoUpdate({
        target: profiles.uid,
        set: {
          email,
          lastActiveAt: new Date(),
        },
      })
      .returning();

    return inserted;
  } catch (error) {
    console.error('Database profile sync failed:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing Bearer token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const profile = await getOrCreateProfile(decodedToken);
    if (profile.isSuspended) {
      return res.status(403).json({ error: 'Account is suspended by an administrator.' });
    }
    req.profile = profile;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
  }
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.profile) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const isVerifiedAdmin =
    req.profile.role === 'admin' ||
    (req.user.email && req.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

  if (!isVerifiedAdmin) {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required' });
  }
  next();
};

// In-memory sliding window rate limiter for sensitive actions
const rateBuckets = new Map<string, number[]>();

export function rateLimit(actionKey: string, maxRequests: number, windowMs: number) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const actor = req.profile?.id ? `p:${req.profile.id}` : req.ip || 'anon';
    const key = `${actionKey}:${actor}`;
    const now = Date.now();
    const recent = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait a moment before trying again.',
      });
    }
    recent.push(now);
    rateBuckets.set(key, recent);
    next();
  };
}
