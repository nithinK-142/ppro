const express = require('express');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { getMe, updateProfile } = require('../controllers/profile');
const { profileSchema } = require('../validation/profile');

const router = express.Router();
router.use(authenticate);
router.get('/', getMe);
router.patch('/', validate({ body: profileSchema }), updateProfile);

module.exports = router;
