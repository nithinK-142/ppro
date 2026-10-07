export function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

export function validatePassword(value: string): boolean {
  return value.length >= 8;
}

export function validateMobile(value: string): boolean {
  return /^\+91\d{10}$/.test(value.trim());
}
