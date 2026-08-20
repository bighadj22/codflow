// Form validation utilities

export function validateRequiredField(value: string, fieldName: string): string | null {
  if (!value || value.trim().length === 0) {
    return `${fieldName} is required`;
  }
  return null;
}

export function validatePhoneNumber(phone: string): string | null {
  // Algerian phone format: 0XXXXXXXXX (10 digits starting with 0)
  const phoneRegex = /^0[0-9]{9}$/;
  
  if (!phone || phone.trim().length === 0) {
    return "Phone number is required";
  }
  
  if (!phoneRegex.test(phone.trim())) {
    return "Invalid phone number format. Must be 10 digits starting with 0";
  }
  
  return null;
}

export function validateNumericField(value: string, fieldName: string): string | null {
  if (!value || value.trim().length === 0) {
    return `${fieldName} is required`;
  }
  
  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return `${fieldName} must be a valid number`;
  }
  
  return null;
}

export function validatePositiveNumber(value: number, fieldName: string): string | null {
  if (value < 0) {
    return `${fieldName} must be a positive number`;
  }
  return null;
}

export function validateMinLength(value: string, minLength: number, fieldName: string): string | null {
  if (value.trim().length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`;
  }
  return null;
}
