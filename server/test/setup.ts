import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-abcdefghijklmnopqrstuvwxyz';
process.env.OTP_SECRET = 'test-otp-secret-abcdefghijklmnopqrstuvwxyz';
process.env.CLIENT_ORIGIN = 'http://localhost:8081';
