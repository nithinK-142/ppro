# Bruno

Import the `bruno/` directory as a collection. Select `local` under environments.

Run the requests in this order:

1. Register
2. Read the OTP from the email inbox
3. Verify email
4. Login
5. Profile
6. Tasks

Login saves the access JWT to `token` and the rotating refresh token to `refreshToken`. Use **Auth - Refresh tokens** to rotate both values, then **Auth - Logout** to revoke that session family. Test values live in `environments/local.bru`.
