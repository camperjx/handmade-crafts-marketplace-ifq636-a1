/* global BigInt */
const HUNDRED = BigInt(100);
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

export function parseAudToCents(input) {
  if (typeof input !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(input.trim())) {
    throw new Error('Enter an AUD amount with at most two decimal places.');
  }
  const [dollars, fraction = ''] = input.trim().split('.');
  const cents = BigInt(dollars) * HUNDRED + BigInt(fraction.padEnd(2, '0'));
  if (cents <= BigInt(0) || cents > MAX_CENTS) {
    throw new Error('Enter a positive price no greater than AUD 90071992547409.91.');
  }
  return Number(cents);
}

export function centsToAudString(cents) {
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('Invalid saved price.');
  const amount = BigInt(cents);
  return `${amount / HUNDRED}.${String(amount % HUNDRED).padStart(2, '0')}`;
}

export const formatAud = cents => `AUD ${centsToAudString(cents)}`;
