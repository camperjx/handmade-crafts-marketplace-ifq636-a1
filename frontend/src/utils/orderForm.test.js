import { validateOrderQuantity, orderFailure } from './orderForm';
test.each(['0','-1','1.5','101','2abc','1e2','',' ',null,undefined])('rejects unsafe or ambiguous quantity %s', value => {
  expect(validateOrderQuantity(value,2500).error).toBeTruthy();
});
test.each([['1',1,2500],['2',2,5000],['100',100,250000]])('calculates a bounded integer estimate for %s', (input,quantity,totalCents) => {
  expect(validateOrderQuantity(input,2500)).toEqual({quantity,totalCents});
});
test('refuses an unsafe estimated total and keeps field errors', () => {
  expect(validateOrderQuantity('2',Number.MAX_SAFE_INTEGER).error).toBeTruthy();
  const error=orderFailure({response:{status:400,data:{errors:{quantity:'Invalid.'}}}},'fallback');
  expect(error.fields.quantity).toBe('Invalid.');expect(error.uncertain).toBe(false);
});
