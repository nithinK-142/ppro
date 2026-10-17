import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { db } from '../db/index.ts';
import env from '../config/env.ts';
import { refreshTokens } from '../db/schema/index.ts';

const REFRESH_TOKEN_BYTES = 32;
const DAY_MS = 24 * 60 * 60 * 1000;
const RECOVERY_KEY = createHash('sha256').update('padosipro:refresh-recovery:v1:').update(env.JWT_SECRET).digest();

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

type RecoveryEnvelope = { version: 1; iv: string; tag: string; ciphertext: string };

export type RefreshRotationResult =
  | { status: 'rotated' | 'replayed'; userId: number; tokens: TokenPair }
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

function recoveryAad(tokenHash: string, attemptId: string) {
  return Buffer.from(`${tokenHash}:${attemptId}`, 'utf8');
}

function encryptRecoveryResponse(tokens: TokenPair, tokenHash: string, attemptId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', RECOVERY_KEY, iv);
  cipher.setAAD(recoveryAad(tokenHash, attemptId));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  const envelope: RecoveryEnvelope = {
    version: 1,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    ciphertext: ciphertext.toString('base64url')
  };
  return JSON.stringify(envelope);
}

function decryptRecoveryResponse(serialized: string, tokenHash: string, attemptId: string): TokenPair {
  const envelope = JSON.parse(serialized) as RecoveryEnvelope;
  if (envelope.version !== 1) throw new Error('Unsupported refresh recovery payload version');
  const decipher = createDecipheriv('aes-256-gcm', RECOVERY_KEY, Buffer.from(envelope.iv, 'base64url'));
  decipher.setAAD(recoveryAad(tokenHash, attemptId));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
    decipher.final()
  ]).toString('utf8');
  const value = JSON.parse(plaintext) as Partial<TokenPair>;
  if (typeof value.accessToken !== 'string' || typeof value.refreshToken !== 'string') {
    throw new Error('Invalid refresh recovery payload');
  }
  return { accessToken: value.accessToken, refreshToken: value.refreshToken };
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

export async function rotateRefreshToken(token: string, attemptId?: string): Promise<RefreshRotationResult> {
  const tokenHash = hashRefreshToken(token);
  const now = new Date();

  const result = await db.transaction<RefreshRotationResult>(async (tx) => {
    const [record] = await tx.select().from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .for('update')
      .limit(1);

    if (!record) return { status: 'invalid' };

    if (record.replacedByHash) {
      if (attemptId && record.rotationAttemptId === attemptId && record.rotationResponse) {
        const [successor] = await tx.select().from(refreshTokens)
          .where(eq(refreshTokens.tokenHash, record.replacedByHash))
          .for('update')
          .limit(1);

        if (!successor || successor.revokedAt || successor.replacedByHash || successor.expiresAt.getTime() <= now.getTime()) {
          return { status: 'invalid', userId: record.userId };
        }

        const tokens = decryptRecoveryResponse(record.rotationResponse, tokenHash, attemptId);
        if (hashRefreshToken(tokens.refreshToken) !== successor.tokenHash) {
          throw new Error('Refresh recovery payload does not match its successor token');
        }
        return { status: 'replayed', userId: record.userId, tokens };
      }

      await tx.update(refreshTokens)
        .set({ revokedAt: now })
        .where(and(eq(refreshTokens.familyId, record.familyId), isNull(refreshTokens.revokedAt)));
      return { status: 'reused', userId: record.userId };
    }

    if (record.revokedAt) return { status: 'invalid', userId: record.userId };

    if (record.expiresAt.getTime() <= now.getTime()) {
      await tx.update(refreshTokens)
        .set({ revokedAt: now })
        .where(and(eq(refreshTokens.familyId, record.familyId), isNull(refreshTokens.revokedAt)));
      return { status: 'expired', userId: record.userId };
    }

    const tokens = { accessToken: createAccessToken(record.userId), refreshToken: createRefreshToken() };
    const nextTokenHash = hashRefreshToken(tokens.refreshToken);
    const rotationResponse = attemptId ? encryptRecoveryResponse(tokens, tokenHash, attemptId) : null;

    await tx.update(refreshTokens)
      .set({
        revokedAt: now,
        replacedByHash: nextTokenHash,
        rotationAttemptId: attemptId ?? null,
        rotationResponse
      })
      .where(eq(refreshTokens.id, record.id));

    await tx.insert(refreshTokens).values({
      userId: record.userId,
      familyId: record.familyId,
      tokenHash: nextTokenHash,
      // Keep a fixed absolute lifetime for the whole session family.
      expiresAt: record.expiresAt,
      createdAt: now
    });

    return { status: 'rotated', userId: record.userId, tokens };
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
