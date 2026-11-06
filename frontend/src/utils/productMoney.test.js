import { centsToAudString, formatAud, parseAudToCents } from './productMoney';

test.each([['25', 2500], ['25.0', 2500], ['25.00', 2500], ['25.01', 2501], ['0.01', 1], [' 30.00 ', 3000], ['00025.1', 2510], ['90071992547409.91', Number.MAX_SAFE_INTEGER]])('converts AUD %s exactly to cents', (input, cents) => {
  expect(parseAudToCents(input)).toBe(cents);
  expect(parseAudToCents(centsToAudString(cents))).toBe(cents);
});
test.each(['', ' ', '0', '0.00', '-1', '1.234', '1e2', '1,000', 'Infinity', 'abc', '.25', '25.', '90071992547409.92', null, 25])('rejects an invalid or unsafe AUD input %s', input => {
  expect(() => parseAudToCents(input)).toThrow();
});
test('formats cents without losing precision near the safe-integer limit', () => {
  expect(formatAud(2500)).toBe('AUD 25.00');
  expect(centsToAudString(1)).toBe('0.01');
  expect(centsToAudString(Number.MAX_SAFE_INTEGER)).toBe('90071992547409.91');
  expect(centsToAudString(Number.MAX_SAFE_INTEGER - 1)).toBe('90071992547409.90');
});
test.each([0, -1, 25.5, '2500', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid stored cents %s', cents => {
  expect(() => centsToAudString(cents)).toThrow();
});
