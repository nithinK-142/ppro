import express from 'express';
import authenticate from '../middleware/auth.ts';
import validate from '../middleware/validate.ts';
import { getMe, updateProfile } from '../controllers/profile.ts';
import { profileSchema } from '../validation/profile.ts';
import captureRoute from '../middleware/route-context.ts';

const router = express.Router();
router.get('/', captureRoute, authenticate, getMe);
router.patch('/', captureRoute, authenticate, validate(profileSchema), updateProfile);

export default router;
