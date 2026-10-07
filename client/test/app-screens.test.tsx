import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { testRouter } from './setup';
import type { AuthStatus, Profile as ProfileData, Task, User } from '../src/types';

const authState = vi.hoisted(() => ({
  user: { id: 1, email: 'user@example.com', emailVerifiedAt: '2026-10-07T00:00:00Z' } as User,
  profile: { name: 'Nithin Kumar', mobile: '+919876543210', address: 'Bangalore', businessName: 'Padosi Homes' } as ProfileData | null,
  selectedTasks: [] as Task[],
  updateProfile: vi.fn(),
  updateTasks: vi.fn(),
  signOut: vi.fn(async () => undefined),
  refresh: vi.fn(async () => undefined),
  status: 'signed_in' as AuthStatus
}));
const taskApi = vi.hoisted(() => ({ getTasks: vi.fn(), saveSelectedTasks: vi.fn() }));
const profileApi = vi.hoisted(() => ({ saveProfile: vi.fn() }));

vi.mock('../src/state/auth', () => ({ useAuth: () => authState }));
vi.mock('../src/api/tasks', () => taskApi);
vi.mock('../src/api/profile', () => profileApi);

import Tasks from '../app/(app)/tasks';
import Home from '../app/(app)/home';
import Profile from '../app/(app)/profile';
import OnboardingProfile from '../app/(onboarding)/profile';
import Index from '../app/index';

beforeEach(() => {
  authState.user = { id: 1, email: 'user@example.com', emailVerifiedAt: '2026-10-07T00:00:00Z' };
  authState.profile = { name: 'Nithin Kumar', mobile: '+919876543210', address: 'Bangalore', businessName: 'Padosi Homes' };
  authState.selectedTasks = [];
  authState.status = 'signed_in';
  authState.updateProfile.mockReset();
  authState.updateTasks.mockReset();
  authState.signOut.mockReset();
  authState.signOut.mockResolvedValue(undefined);
  authState.refresh.mockReset();
  authState.refresh.mockResolvedValue(undefined);
  taskApi.getTasks.mockReset();
  taskApi.saveSelectedTasks.mockReset();
  profileApi.saveProfile.mockReset();
});

const tasks = [
  { id: 1, name: 'AC service visit', category: 'Home Services', description: 'Arrange AC service.' },
  { id: 2, name: 'Doctor appointment', category: 'Health & Medical', description: 'Coordinate a doctor appointment.' },
  { id: 3, name: 'Grocery restocking', category: 'Errands & Daily Tasks', description: 'Restock the home.' }
];

describe('onboarding profile screen', () => {
  it('validates required fields before saving', async () => {
    authState.profile = null;
    await render(<OnboardingProfile />);
    await fireEvent.press(screen.getByTestId('profile-submit'));
    expect(screen.getByText('Enter your name')).toBeTruthy();
    expect(screen.getByText('Use +91 followed by 10 digits')).toBeTruthy();
    expect(screen.getByText('Add your address')).toBeTruthy();
    expect(profileApi.saveProfile).not.toHaveBeenCalled();
  });

  it('saves a valid profile and moves to task selection', async () => {
    profileApi.saveProfile.mockResolvedValue({ name: 'Nithin Kumar', mobile: '+919876543210', address: 'Bangalore', businessName: '' });
    await render(<OnboardingProfile />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Nithin Kumar');
    await fireEvent.changeText(screen.getByLabelText('Mobile number'), '+919876543210');
    await fireEvent.changeText(screen.getByLabelText('Address'), 'Bangalore');
    await fireEvent.changeText(screen.getByLabelText('Business name (optional)'), '');
    await fireEvent.press(screen.getByTestId('profile-submit'));
    expect(profileApi.saveProfile).toHaveBeenCalledWith({ name: 'Nithin Kumar', mobile: '+919876543210', address: 'Bangalore', businessName: '' });
    expect(authState.updateProfile).toHaveBeenCalled();
    expect(testRouter.replace).toHaveBeenCalledWith('/(app)/tasks');
  });


  it('shows profile save errors', async () => {
    profileApi.saveProfile.mockRejectedValue(new Error('Profile save failed'));
    await render(<OnboardingProfile />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Nithin Kumar');
    await fireEvent.changeText(screen.getByLabelText('Mobile number'), '+919876543210');
    await fireEvent.changeText(screen.getByLabelText('Address'), 'Bangalore');
    await fireEvent.press(screen.getByTestId('profile-submit'));
    expect(screen.getByText('Profile save failed')).toBeTruthy();
  });
});

describe('tasks screen', () => {
  it('loads tasks and filters by search', async () => {
    taskApi.getTasks.mockResolvedValue(tasks);
    await render(<Tasks />);
    expect(await screen.findByText('AC service visit')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search tasks'), 'doctor');
    expect(screen.getByText('Doctor appointment')).toBeTruthy();
    expect(screen.queryByText('AC service visit')).toBeNull();
  });

  it('filters by category', async () => {
    taskApi.getTasks.mockResolvedValue(tasks);
    await render(<Tasks />);
    await screen.findByText('AC service visit');
    await fireEvent.press(screen.getByRole('button', { name: 'Health & Medical' }));
    expect(screen.getByText('Doctor appointment')).toBeTruthy();
    expect(screen.queryByText('AC service visit')).toBeNull();
  });

  it('selects a task and reviews the selection', async () => {
    taskApi.getTasks.mockResolvedValue(tasks);
    authState.selectedTasks = [];
    await render(<Tasks />);
    await screen.findByText('AC service visit');
    const task = screen.getByTestId('task-1');
    await fireEvent.press(task);
    expect(task.props.accessibilityState.checked).toBe(true);
    expect(screen.getByText('1 selected')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tasks-review'));
    expect(screen.getByText('This is what you want handled.')).toBeTruthy();
    expect(screen.getByText('AC service visit')).toBeTruthy();
  });

  it('saves selected tasks and routes home', async () => {
    taskApi.getTasks.mockResolvedValue(tasks);
    taskApi.saveSelectedTasks.mockResolvedValue([tasks[0], tasks[2]]);
    authState.selectedTasks = [tasks[0]];
    await render(<Tasks />);
    await screen.findByText('AC service visit');
    await fireEvent.press(screen.getByTestId('task-3'));
    await fireEvent.press(screen.getByTestId('tasks-review'));
    await fireEvent.press(screen.getByTestId('tasks-confirm'));
    expect(taskApi.saveSelectedTasks).toHaveBeenCalledWith([1, 3]);
    expect(authState.updateTasks).toHaveBeenCalledWith([tasks[0], tasks[2]]);
    expect(testRouter.replace).toHaveBeenCalledWith('/(app)/home');
  });

  it('shows load errors and supports retry', async () => {
    taskApi.getTasks.mockRejectedValueOnce(new Error('API offline')).mockResolvedValueOnce(tasks);
    await render(<Tasks />);
    expect(await screen.findByText('API offline')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('AC service visit')).toBeTruthy();
  });


  it('shows save errors and allows retry', async () => {
    taskApi.getTasks.mockResolvedValue(tasks);
    taskApi.saveSelectedTasks.mockRejectedValueOnce(new Error('Save failed')).mockResolvedValueOnce([tasks[0]]);
    await render(<Tasks />);
    await screen.findByText('AC service visit');
    await fireEvent.press(screen.getByTestId('task-1'));
    await fireEvent.press(screen.getByTestId('tasks-review'));
    await fireEvent.press(screen.getByTestId('tasks-confirm'));
    expect(await screen.findByText('Save failed')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(testRouter.replace).toHaveBeenCalledWith('/(app)/home');
  });
});

describe('home and profile screens', () => {
  it('renders selected services and household data', async () => {
    authState.selectedTasks = [tasks[0], tasks[1]];
    await render(<Home />);
    expect(screen.getByText('Good to have you back, Nithin.')).toBeTruthy();
    expect(screen.getByText('AC service visit')).toBeTruthy();
    expect(screen.getByText('Doctor appointment')).toBeTruthy();
    expect(screen.getByText('2 services')).toBeTruthy();
    expect(screen.getByText('Bangalore')).toBeTruthy();
  });

  it('opens account menu and handles profile/logout', async () => {
    await render(<Home />);
    await fireEvent.press(screen.getByTestId('account-menu'));
    expect(screen.getByText('ACCOUNT')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
    expect(testRouter.push).toHaveBeenCalledWith('/(app)/profile');

    await fireEvent.press(screen.getByTestId('account-menu'));
    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(authState.signOut).toHaveBeenCalled());
    expect(testRouter.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('profile screen shows values and navigation', async () => {
    await render(<Profile />);
    expect(screen.getByText('user@example.com')).toBeTruthy();
    expect(screen.getByText('Padosi Homes')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('profile-back'));
    expect(testRouter.back).toHaveBeenCalledOnce();
    await fireEvent.press(screen.getByTestId('profile-change-services'));
    expect(testRouter.push).toHaveBeenCalledWith('/(app)/tasks');
  });

  it('home empty state links to tasks', async () => {
    authState.selectedTasks = [];
    await render(<Home />);
    expect(screen.getByText('Your service list is empty')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose services' }));
    expect(testRouter.push).toHaveBeenCalledWith('/(app)/tasks');
  });
});

describe('root routing', () => {
  it('shows loading state while auth restores', async () => {
    authState.status = 'loading';
    await render(<Index />);
    expect(screen.queryByTestId('router-redirect')).toBeNull();
  });


  it('shows a session error with retry action', async () => {
    authState.status = 'session_error';
    await render(<Index />);
    expect(screen.getByText('Connection problem')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(authState.refresh).toHaveBeenCalledOnce();
  });

  it('redirects signed-out users to login', async () => {
    authState.status = 'signed_out';
    authState.profile = null;
    authState.selectedTasks = [];
    await render(<Index />);
    expect(screen.getByTestId('router-redirect').props.children).toBe('/(auth)/login');
  });

  it('redirects incomplete setup to profile, tasks, then home', async () => {
    authState.status = 'signed_in';
    authState.profile = null;
    authState.selectedTasks = [];
    const view = await render(<Index />);
    expect(screen.getByTestId('router-redirect').props.children).toBe('/(onboarding)/profile');

    authState.profile = { name: 'N', mobile: '+919876543210', address: 'B', businessName: '' };
    await view.rerender(<Index />);
    expect(screen.getByTestId('router-redirect').props.children).toBe('/(app)/tasks');

    authState.selectedTasks = [tasks[0]];
    await view.rerender(<Index />);
    expect(screen.getByTestId('router-redirect').props.children).toBe('/(app)/home');
  });
});
