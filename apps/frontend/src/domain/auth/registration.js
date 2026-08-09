export const MINIMUM_PASSWORD_LENGTH = 15;

function registrationError(message) {
  const error = new Error(message);
  error.code = 'INVALID_REGISTRATION';
  return error;
}

export function prepareRegistration({ displayName = '', email = '', password = '', confirmPassword = '' }) {
  const normalizedDisplayName = displayName.trim().replace(/\s+/g, ' ');
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedDisplayName) {
    throw registrationError('Enter the name you want shown on your account.');
  }
  if (normalizedDisplayName.length > 120) {
    throw registrationError('Account names must be 120 characters or fewer.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw registrationError('Enter a valid email address.');
  }
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    throw registrationError(`Use at least ${MINIMUM_PASSWORD_LENGTH} characters for your password.`);
  }
  if (password !== confirmPassword) {
    throw registrationError('The passwords do not match.');
  }

  return {
    displayName: normalizedDisplayName,
    email: normalizedEmail,
    password
  };
}
