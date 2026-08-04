export const isRequired = (value) => String(value ?? '').trim().length > 0
export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())
export const hasMinLength = (value, length) => String(value ?? '').length >= length
