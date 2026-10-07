import { describe, expect, it } from 'vitest';
import { validateCredentials, validateEmail, validateMobile, validatePassword } from '../src/utils/form';
import { getErrorMessage } from '../src/utils/errors';
import { groupTasksByCategory } from '../src/utils/tasks';

describe('form validation', () => {
  it('accepts valid email and rejects invalid email', () => {
    expect(validateEmail(' USER@example.com ')).toBe(true);
    expect(validateEmail('bad@')).toBe(false);
  });

  it('validates password and mobile formats', () => {
    expect(validatePassword('12345678')).toBe(true);
    expect(validatePassword('short')).toBe(false);
    expect(validateMobile('+919876543210')).toBe(true);
    expect(validateMobile('9876543210')).toBe(false);
  });

  it('returns field-specific credential errors', () => {
    expect(validateCredentials('bad', 'short', 'different')).toEqual({
      email: 'Enter a valid email',
      password: 'Use at least 8 characters',
      confirmPassword: 'Passwords do not match'
    });
  });
});

describe('task utilities', () => {
  it('groups tasks while preserving first-seen category order', () => {
    const tasks = [
      { id: 1, name: 'A', category: 'Home', description: 'a' },
      { id: 2, name: 'B', category: 'Errands', description: 'b' },
      { id: 3, name: 'C', category: 'Home', description: 'c' }
    ];

    expect(groupTasksByCategory(tasks)).toEqual([
      ['Home', [tasks[0], tasks[2]]],
      ['Errands', [tasks[1]]]
    ]);
  });
});

describe('error messages', () => {
  it('uses Error messages and fallbacks', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(getErrorMessage({ message: 'ignored' }, 'fallback')).toBe('fallback');
  });
});
