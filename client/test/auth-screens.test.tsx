import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError } from '../src/api/client';
import { routeParams, testRouter } from './setup';

const authState = vi.hoisted(() => ({ signIn: vi.fn() }));
const authApi = vi.hoisted(() => ({ register: vi.fn(), verifyEmail: vi.fn(), resendVerification: vi.fn() }));

vi.mock('../src/state/auth', () => ({ useAuth: () => authState }));
vi.mock('../src/api/auth', () => authApi);

import Login from '../app/(auth)/login';
import Register from '../app/(auth)/register';
import Verify from '../app/(auth)/verify';

beforeEach(() => {
  authState.signIn.mockReset();
  authApi.register.mockReset();
  authApi.verifyEmail.mockReset();
  authApi.resendVerification.mockReset();
});

describe('auth screens', () => {
  it('login shows validation errors', async () => {
    await render(<Login />);
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(screen.getByText('Enter a valid email')).toBeTruthy();
    expect(screen.getByText('Use at least 8 characters')).toBeTruthy();
  });

  it('login signs in and redirects home', async () => {
    authState.signIn.mockResolvedValue(undefined);
    await render(<Login />);
    await fireEvent.changeText(screen.getByLabelText('Email'), ' USER@example.com ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'StrongPass123!');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(authState.signIn).toHaveBeenCalledWith('user@example.com', 'StrongPass123!');
    expect(testRouter.replace).toHaveBeenCalledWith('/');
  });

  it('login routes unverified users to verification', async () => {
    authState.signIn.mockRejectedValue(new ApiError('Verify', 'EMAIL_NOT_VERIFIED', 403));
    await render(<Login />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'user@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'StrongPass123!');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(testRouter.push).toHaveBeenCalledWith({
      pathname: '/(auth)/verify',
      params: { email: 'user@example.com' }
    });
  });

  it('login shows server errors', async () => {
    authState.signIn.mockRejectedValue(new Error('Server unavailable'));
    await render(<Login />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'user@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'StrongPass123!');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(screen.getByText('Server unavailable')).toBeTruthy();
  });

  it('login shows verified message from route params', async () => {
    routeParams.verified = '1';
    await render(<Login />);
    expect(screen.getByText('Email verified. Sign in to continue.')).toBeTruthy();
  });

  it('register validates password confirmation', async () => {
    await render(<Register />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'user@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'StrongPass123!');
    await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'Different123!');
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(screen.getByText('Passwords do not match')).toBeTruthy();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('register normalizes email and routes to verification', async () => {
    authApi.register.mockResolvedValue({ userId: 1, email: 'user@example.com', verificationRequired: true });
    await render(<Register />);
    await fireEvent.changeText(screen.getByLabelText('Email'), ' USER@example.com ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'StrongPass123!');
    await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'StrongPass123!');
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(authApi.register).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'StrongPass123!',
      confirmPassword: 'StrongPass123!'
    });
    expect(testRouter.push).toHaveBeenCalledWith({
      pathname: '/(auth)/verify',
      params: { email: 'user@example.com' }
    });
  });

  it('register shows API error', async () => {
    authApi.register.mockRejectedValue(new Error('Email already exists'));
    await render(<Register />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'user@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'StrongPass123!');
    await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'StrongPass123!');
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(screen.getByText('Email already exists')).toBeTruthy();
  });

  it('verify sanitizes OTP input and blocks incomplete submissions', async () => {
    routeParams.email = 'user@example.com';
    await render(<Verify />);
    const input = screen.getByLabelText('Email verification code');
    await fireEvent.changeText(input, '12a34-');
    expect(input.props.value).toBe('1234');
    expect(screen.getByTestId('verify-submit').props.disabled).toBe(true);
    expect(authApi.verifyEmail).not.toHaveBeenCalled();
  });

  it('verify submits six-digit OTP and redirects to login', async () => {
    routeParams.email = 'user@example.com';
    authApi.verifyEmail.mockResolvedValue({ verified: true });
    await render(<Verify />);
    await fireEvent.changeText(screen.getByLabelText('Email verification code'), '123456');
    await fireEvent.press(screen.getByTestId('verify-submit'));
    expect(authApi.verifyEmail).toHaveBeenCalledWith({ email: 'user@example.com', otp: '123456' });
    expect(testRouter.replace).toHaveBeenCalledWith({ pathname: '/(auth)/login', params: { verified: '1' } });
  });

  it('verify shows verification failures', async () => {
    routeParams.email = 'user@example.com';
    authApi.verifyEmail.mockRejectedValue(new Error('The verification code is incorrect'));
    await render(<Verify />);
    await fireEvent.changeText(screen.getByLabelText('Email verification code'), '123456');
    await fireEvent.press(screen.getByTestId('verify-submit'));
    expect(screen.getByText('The verification code is incorrect')).toBeTruthy();
  });

  it('verify handles resend cooldown response', async () => {
    vi.useFakeTimers();
    routeParams.email = 'user@example.com';
    authApi.resendVerification.mockRejectedValue(new ApiError('Try again in 7 seconds', 'OTP_COOLDOWN', 429, { retryAfterSeconds: 7 }));
    await render(<Verify />);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(screen.getByText('Did not get it?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Send again' }));
    expect(screen.getByText('Try again in 7 seconds')).toBeTruthy();
    expect(screen.getByText('Resend in 7s')).toBeTruthy();
    vi.useRealTimers();
  });
});
