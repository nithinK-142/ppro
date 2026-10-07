import express from 'express';
import authenticate from '../middleware/auth.ts';
import validate from '../middleware/validate.ts';
import { getMe, updateProfile } from '../controllers/profile.ts';
import { profileSchema } from '../validation/profile.ts';

const router = express.Router();
router.use(authenticate);
router.get('/', getMe);
router.patch('/', validate(profileSchema), updateProfile);

export default router;
