export function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

export function validatePassword(value: string): boolean {
  return value.length >= 8;
}

export function validateMobile(value: string): boolean {
  return /^\+91\d{10}$/.test(value.trim());
}

export function validateCredentials(email: string, password: string, confirmPassword?: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!validateEmail(email)) errors.email = 'Enter a valid email';
  if (!validatePassword(password)) errors.password = 'Use at least 8 characters';
  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }
  return errors;
}
