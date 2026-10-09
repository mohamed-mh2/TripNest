const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function inputObject(body) {
  return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
}

function validateRegistration(body) {
  const input = inputObject(body);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const errors = {};

  if (name.length < 2 || name.length > 100) errors.name = 'Name must be between 2 and 100 characters.';
  if (!EMAIL_RE.test(email) || email.length > 254) errors.email = 'Enter a valid email address.';
  if (Buffer.byteLength(password, 'utf8') < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    errors.password = 'Password must be at least 8 bytes and no more than 72 bytes.';
  }
  return { value: { name, email, password }, errors };
}

function validateLogin(body) {
  const input = inputObject(body);
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const errors = {};
  if (!EMAIL_RE.test(email) || email.length > 254) errors.email = 'Enter a valid email address.';
  if (!password || Buffer.byteLength(password, 'utf8') > 72) errors.password = 'Enter a valid password.';
  return { value: { email, password }, errors };
}

module.exports = { validateRegistration, validateLogin };
