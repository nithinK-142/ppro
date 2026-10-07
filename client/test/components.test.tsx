import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '../src/components/Button';
import { Field } from '../src/components/Field';
import { StateCard } from '../src/components/StateCard';
import { AccountMenu } from '../src/components/AccountMenu';
import { AuthScreen } from '../src/components/AuthScreen';
import { ProfileIcon } from '../src/components/ProfileIcon';
import { Screen } from '../src/components/Screen';

describe('shared UI components', () => {
  it('Button fires press and respects disabled state', async () => {
    const onPress = vi.fn();
    await render(<Button label="Continue" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('Button disables itself while loading', async () => {
    const onPress = vi.fn();
    await render(<Button label="Save" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Save' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('Field exposes label, value, and validation error', async () => {
    await render(<Field label="Email" value="bad" onChangeText={vi.fn()} error="Invalid email" />);
    expect(screen.getByLabelText('Email').props.value).toBe('bad');
    expect(screen.getByText('Invalid email')).toBeTruthy();
  });

  it('StateCard renders alert and optional action', async () => {
    const onAction = vi.fn();
    await render(<StateCard title="Failed" message="Try again" actionLabel="Retry" onAction={onAction} />);
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('AccountMenu routes profile and logout actions', async () => {
    const onClose = vi.fn();
    const onProfile = vi.fn();
    const onLogout = vi.fn();
    await render(<AccountMenu visible onClose={onClose} onProfile={onProfile} onLogout={onLogout} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
    expect(onProfile).toHaveBeenCalledOnce();
    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    expect(onLogout).toHaveBeenCalledOnce();
    await fireEvent.press(screen.getByLabelText('Close account menu'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('AuthScreen and Screen render children', async () => {
    await render(<AuthScreen><Screen><Button label="Child" onPress={vi.fn()} /></Screen></AuthScreen>);
    expect(screen.getByRole('button', { name: 'Child' })).toBeTruthy();
  });

  it('ProfileIcon renders without crashing', async () => {
    await render(<ProfileIcon size={40} />);
    expect(screen.toJSON()).toBeTruthy();
  });
});
