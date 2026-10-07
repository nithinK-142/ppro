import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { ApiError } from '../src/api/client';

const authApi = vi.hoisted(() => ({ login: vi.fn(), getMe: vi.fn() }));
const tokenApi = vi.hoisted(() => ({ getToken: vi.fn(), setToken: vi.fn(), clearToken: vi.fn() }));

vi.mock('../src/api/auth', () => ({ login: authApi.login }));
vi.mock('../src/api/profile', () => ({ getMe: authApi.getMe }));
vi.mock('../src/storage/token', () => tokenApi);

import { AuthProvider, useAuth } from '../src/state/auth';

beforeEach(() => {
  authApi.login.mockReset();
  authApi.getMe.mockReset();
  tokenApi.getToken.mockReset();
  tokenApi.setToken.mockReset();
  tokenApi.clearToken.mockReset();
});


function Consumer() {
  const auth = useAuth();
  return (
    <>
      <Text testID="status">{auth.status}</Text>
      <Text testID="email">{auth.user?.email || ''}</Text>
      <Text testID="tasks">{String(auth.selectedTasks.length)}</Text>
      <ButtonLike label="sign in" onPress={() => void auth.signIn('a@b.com', '12345678')} />
      <ButtonLike label="sign out" onPress={() => void auth.signOut()} />
      <ButtonLike label="refresh" onPress={() => void auth.refresh()} />
    </>
  );
}

function ButtonLike({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}><Text>{label}</Text></Pressable>;
}

describe('AuthProvider', () => {
  it('starts signed out when there is no token', async () => {
    tokenApi.getToken.mockResolvedValue(null);
    await render(<AuthProvider><Consumer /></AuthProvider>);
    expect(String((await screen.findByTestId('status')).props.children)).toBe('signed_out');
  });

  it('restores a valid session', async () => {
    tokenApi.getToken.mockResolvedValue('token');
    authApi.getMe.mockResolvedValue({ user: { id: 1, email: 'a@b.com', emailVerifiedAt: null }, profile: null, selectedTasks: [{ id: 1, name: 'A', category: 'Home', description: 'A' }] });
    await render(<AuthProvider><Consumer /></AuthProvider>);
    expect(String((await screen.findByTestId('status')).props.children)).toBe('signed_in');
    expect(String(screen.getByTestId('email').props.children)).toBe('a@b.com');
    expect(String(screen.getByTestId('tasks').props.children)).toBe('1');
  });

  it('clears an expired session on 401/403', async () => {
    tokenApi.getToken.mockResolvedValue('token');
    authApi.getMe.mockRejectedValue(new ApiError('expired', 'INVALID_TOKEN', 401));
    await render(<AuthProvider><Consumer /></AuthProvider>);
    expect(String((await screen.findByTestId('status')).props.children)).toBe('signed_out');
    expect(tokenApi.clearToken).toHaveBeenCalledOnce();
  });

  it('exposes session_error for other restore failures', async () => {
    tokenApi.getToken.mockResolvedValue('token');
    authApi.getMe.mockRejectedValue(new Error('offline'));
    await render(<AuthProvider><Consumer /></AuthProvider>);
    expect(String((await screen.findByTestId('status')).props.children)).toBe('session_error');
  });

  it('signs in, stores token, then signs out', async () => {
    tokenApi.getToken.mockResolvedValue(null);
    authApi.login.mockResolvedValue({
      token: 'new-token',
      user: { id: 1, email: 'a@b.com', emailVerifiedAt: '2026-10-07T00:00:00Z' },
      profile: null,
      selectedTasks: [],
      setupComplete: false
    });
    await render(<AuthProvider><Consumer /></AuthProvider>);
    await screen.findByTestId('status');
    await fireEvent.press(screen.getByRole('button', { name: 'sign in' }));
    expect(String((await screen.findByTestId('status')).props.children)).toBe('signed_in');
    expect(tokenApi.setToken).toHaveBeenCalledWith('new-token');
    await fireEvent.press(screen.getByRole('button', { name: 'sign out' }));
    expect(String(screen.getByTestId('status').props.children)).toBe('signed_out');
    expect(tokenApi.clearToken).toHaveBeenCalled();
  });

  it('throws when useAuth is outside the provider', async () => {
    function Broken() {
      useAuth();
      return null;
    }
    expect(() => Broken()).toThrow('useAuth must be used within AuthProvider');
  });
});
