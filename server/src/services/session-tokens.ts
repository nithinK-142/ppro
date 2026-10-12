import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { db } from '../config/db.ts';
import env from '../config/env.ts';
import { refreshTokens } from '../config/schema.ts';

const REFRESH_TOKEN_BYTES = 32;
const DAY_MS = 24 * 60 * 60 * 1000;

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type RefreshRotationResult =
  | { status: 'rotated'; userId: number; tokens: TokenPair }
  | { status: 'invalid' | 'expired' | 'reused'; userId?: number };

function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function createAccessToken(userId: number) {
  return jwt.sign(
    { sub: String(userId), tokenUse: 'access' },
    env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: env.ACCESS_TOKEN_EXPIRES_IN }
  );
}

function createRefreshToken() {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

function refreshExpiry(from: Date) {
  return new Date(from.getTime() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS);
}

async function createTokenPair(userId: number, familyId = randomUUID(), expiresAt = refreshExpiry(new Date())): Promise<TokenPair> {
  const accessToken = createAccessToken(userId);
  const refreshToken = createRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();

  await db.transaction(async (tx) => {
    // Expired rows no longer provide replay-detection value because every token in
    // their family has reached its absolute expiry. Remove them during session issue.
    await tx.delete(refreshTokens).where(lt(refreshTokens.expiresAt, now));
    await tx.insert(refreshTokens).values({
      userId,
      familyId,
      tokenHash,
      expiresAt,
      createdAt: now
    });
  });

  return { accessToken, refreshToken };
}

export async function issueTokenPair(userId: number) {
  const familyId = randomUUID();
  const expiresAt = refreshExpiry(new Date());
  return createTokenPair(userId, familyId, expiresAt);
}

export async function rotateRefreshToken(token: string): Promise<RefreshRotationResult> {
  const tokenHash = hashRefreshToken(token);
  const now = new Date();

  const result = await db.transaction<RefreshRotationResult>(async (tx) => {
    const [record] = await tx.select().from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .for('update')
      .limit(1);

    if (!record) return { status: 'invalid' };

    if (record.revokedAt || record.replacedByHash) {
      await tx.update(refreshTokens)
        .set({ revokedAt: now })
        .where(and(eq(refreshTokens.familyId, record.familyId), isNull(refreshTokens.revokedAt)));
      return { status: 'reused', userId: record.userId };
    }

    if (record.expiresAt.getTime() <= now.getTime()) {
      await tx.update(refreshTokens)
        .set({ revokedAt: now })
        .where(and(eq(refreshTokens.familyId, record.familyId), isNull(refreshTokens.revokedAt)));
      return { status: 'expired', userId: record.userId };
    }

    const nextRefreshToken = createRefreshToken();
    const nextTokenHash = hashRefreshToken(nextRefreshToken);

    await tx.update(refreshTokens)
      .set({ revokedAt: now, replacedByHash: nextTokenHash })
      .where(eq(refreshTokens.id, record.id));

    await tx.insert(refreshTokens).values({
      userId: record.userId,
      familyId: record.familyId,
      tokenHash: nextTokenHash,
      // Keep a fixed absolute lifetime for the whole session family.
      expiresAt: record.expiresAt,
      createdAt: now
    });

    return {
      status: 'rotated',
      userId: record.userId,
      tokens: {
        accessToken: createAccessToken(record.userId),
        refreshToken: nextRefreshToken
      }
    };
  });

  return result;
}

export async function revokeRefreshToken(token: string) {
  const tokenHash = hashRefreshToken(token);
  const now = new Date();

  await db.transaction(async (tx) => {
    const [record] = await tx.select({ familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .for('update')
      .limit(1);

    if (!record) return;

    await tx.update(refreshTokens)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokens.familyId, record.familyId), isNull(refreshTokens.revokedAt)));
  });
}
