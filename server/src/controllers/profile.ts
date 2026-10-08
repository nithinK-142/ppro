import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../config/db.ts';
import { profiles, users } from '../config/schema.ts';
import { getSelectedTasks } from '../config/queries.ts';
import type { DataResponse, ProfileData, SessionData } from '../types/api.ts';
import AppError from '../utils/app-error.ts';
import { profileSchema } from '../validation/profile.ts';

type RouteParams = Record<string, string>;
type UpdateProfileInput = z.infer<typeof profileSchema>;
type ProfileHandler = RequestHandler<RouteParams, DataResponse<SessionData>>;
type UpdateProfileHandler = RequestHandler<RouteParams, DataResponse<ProfileData>, UpdateProfileInput>;

const getMe: ProfileHandler = async (req, res) => {
  const userId = req.userId!;
  const [userResult, selectedTasks] = await Promise.all([
    db.select({
      id: users.id,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      name: profiles.name,
      mobile: profiles.mobile,
      address: profiles.address,
      businessName: profiles.businessName,
      profile_updated_at: profiles.updatedAt
    })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1),
    getSelectedTasks(userId)
  ]);

  const row = userResult[0];
  if (!row) throw new AppError(401, 'UNAUTHORIZED', 'User no longer exists');

  const profile = row.name ? {
    name: row.name,
    mobile: row.mobile!,
    address: row.address!,
    businessName: row.businessName,
    updated_at: row.profile_updated_at!
  } : null;

  res.json({
    data: {
      user: { id: row.id, email: row.email, emailVerifiedAt: row.emailVerifiedAt },
      profile,
      selectedTasks,
      setupComplete: Boolean(profile && selectedTasks.length)
    }
  });
};

const updateProfile: UpdateProfileHandler = async (req, res) => {
  const userId = req.userId!;
  const { name, mobile, address, businessName } = req.body;

  await db.insert(profiles).values({
    userId,
    name,
    mobile,
    address,
    businessName: businessName || null
  }).onConflictDoUpdate({
    target: profiles.userId,
    set: {
      name,
      mobile,
      address,
      businessName: businessName || null,
      updatedAt: new Date()
    }
  });

  const [profile] = await db.select({
    name: profiles.name,
    mobile: profiles.mobile,
    address: profiles.address,
    businessName: profiles.businessName,
    updated_at: profiles.updatedAt
  }).from(profiles).where(eq(profiles.userId, userId)).limit(1);

  if (!profile) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load updated profile');

  res.json({ data: profile });
};

export { getMe, updateProfile };
