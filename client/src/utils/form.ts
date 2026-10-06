export function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

export function validatePassword(value) {
  return value.length >= 8;
}

export function validateMobile(value) {
  return /^\+91\d{10}$/.test(value.trim());
}
