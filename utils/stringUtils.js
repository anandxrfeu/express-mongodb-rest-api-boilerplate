/**
 * Extracts and formats the first name from a full name string.
 */
export const extractFirstName = (fullName) => {
  if (typeof fullName !== 'string') return '';
  const trimmed = fullName.trim();
  if (trimmed.length === 0) return '';
  const words = trimmed.split(/\s+/);
  const first = words[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
};
