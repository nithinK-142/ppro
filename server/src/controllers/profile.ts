import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { query } from '../config/db.ts';
import type { UserProfileRow, TaskRow, ProfileRow } from '../types/database.ts';
import type { DataResponse, MeData } from '../types/api.ts';
import AppError from '../utils/app-error.ts';
import { profileSchema } from '../validation/profile.ts';

type RouteParams = Record<string, string>;
type UpdateProfileInput = z.infer<typeof profileSchema>;
type ProfileHandler = RequestHandler<RouteParams, DataResponse<MeData>>;
type UpdateProfileHandler = RequestHandler<RouteParams, DataResponse<ProfileRow>, UpdateProfileInput>;

const getMe: ProfileHandler = async (req, res) => {
  const userId = req.userId!;
  const [userResult, tasksResult] = await Promise.all([
    query<UserProfileRow>(`SELECT u.id, u.email, u.email_verified_at, u.created_at,
        p.name, p.mobile, p.address, p.business_name AS "businessName", p.updated_at AS profile_updated_at
        FROM users u LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.id = $1`, [userId]),
    query<TaskRow>(`SELECT t.id, t.name, t.category, t.description
      FROM user_tasks ut JOIN tasks t ON t.id = ut.task_id
      WHERE ut.user_id = $1 ORDER BY t.category, t.name`, [userId])
  ]);

  const row = userResult.rows[0];
  if (!row) throw new AppError(401, 'UNAUTHORIZED', 'User no longer exists');

  const profile = row.name ? {
    name: row.name,
    mobile: row.mobile!,
    address: row.address!,
    businessName: row.businessName,
    updated_at: row.profile_updated_at!
  } : null;
  const selectedTasks = tasksResult.rows;

  res.json({
    data: {
      user: { id: row.id, email: row.email, emailVerifiedAt: row.email_verified_at },
      profile,
      selectedTasks,
      setupComplete: Boolean(profile && selectedTasks.length)
    }
  });
};

const updateProfile: UpdateProfileHandler = async (req, res) => {
  const userId = req.userId!;
  const { name, mobile, address, businessName } = req.body;

  await query(`INSERT INTO profiles (user_id, name, mobile, address, business_name)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT(user_id) DO UPDATE SET name = EXCLUDED.name, mobile = EXCLUDED.mobile, address = EXCLUDED.address, business_name = EXCLUDED.business_name, updated_at = CURRENT_TIMESTAMP`,
    [userId, name, mobile, address, businessName || null]
  );

  const { rows: [profile] } = await query<ProfileRow>(
    'SELECT name, mobile, address, business_name AS "businessName", updated_at FROM profiles WHERE user_id = $1',
    [userId]
  );
  if (!profile) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load updated profile');

  res.json({ data: profile });
};

export { getMe, updateProfile };
