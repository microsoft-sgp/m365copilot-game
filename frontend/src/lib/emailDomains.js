export const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
]);

export function getEmailDomain(email) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const atIndex = normalizedEmail.lastIndexOf('@');
  if (atIndex < 0 || atIndex === normalizedEmail.length - 1) return '';
  return normalizedEmail.slice(atIndex + 1).replace(/^\.+|\.+$/g, '');
}

export function isPublicEmailDomain(emailOrDomain) {
  const value = (emailOrDomain || '').trim().toLowerCase();
  const domain = value.includes('@') ? getEmailDomain(value) : value.replace(/^\.+|\.+$/g, '');
  return PUBLIC_EMAIL_DOMAINS.has(domain);
}