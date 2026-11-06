import { productFormValues, validateProductForm } from './productForm';

const valid = { title: ' Basket ', description: ' Handwoven in cotton. ', category: ' Textiles ', priceAud: '25.00' };
test('produces only the four allowed create/edit fields', () => {
  const result = validateProductForm({ ...valid, sellerId: 'forged', status: 'active' });
  expect(result.valid).toBe(true);
  expect(result.payload).toEqual({ title: 'Basket', description: 'Handwoven in cotton.', category: 'Textiles', priceCents: 2500 });
});
test.each([['title', 120], ['description', 2000], ['category', 60]])('validates trimmed %s boundaries', (field, length) => {
  expect(validateProductForm({ ...valid, [field]: 'x'.repeat(length) }).valid).toBe(true);
  expect(validateProductForm({ ...valid, [field]: 'x'.repeat(length + 1) }).fields[field]).toBeTruthy();
  expect(validateProductForm({ ...valid, [field]: '   ' }).fields[field]).toBeTruthy();
});
test('maps price errors to the API field without throwing from the form', () => {
  const result = validateProductForm({ ...valid, priceAud: '1.234' });
  expect(result.valid).toBe(false);
  expect(result.fields.priceCents).toBeTruthy();
});
test('loads an exact edit amount and supplies empty create fields', () => {
  expect(productFormValues()).toEqual({ title: '', description: '', category: '', priceAud: '' });
  expect(productFormValues({ title: 'A', description: 'B', category: 'C', priceCents: Number.MAX_SAFE_INTEGER }).priceAud).toBe('90071992547409.91');
});
