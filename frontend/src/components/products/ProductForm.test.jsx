import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import ProductForm from './ProductForm';

global.IS_REACT_ACT_ENVIRONMENT = true;
let container, root;
const saved = { title: 'Basket', description: 'Cotton weave', category: 'Textiles', priceCents: 2500 };
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = props => act(async () => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ProductForm mode="edit" product={saved} {...props} /></MemoryRouter>));
const field = name => container.querySelector(`[name="${name}"]`);
const change = (name, value) => act(() => Simulate.change(field(name), { target: { name, value } }));
const submit = () => act(() => Simulate.submit(container.querySelector('form')));
test('invalid input is preserved, focused and never sent; a valid save uses cents', async () => {
  const onSubmit = jest.fn(); await render({ onSubmit });
  change('priceAud', '1.234'); submit();
  expect(onSubmit).not.toHaveBeenCalled(); expect(document.activeElement).toBe(field('priceAud'));
  expect(field('priceAud').value).toBe('1.234'); expect(field('priceAud').getAttribute('aria-invalid')).toBe('true');
  change('priceAud', '30.00'); submit();
  expect(onSubmit).toHaveBeenCalledWith({ title: 'Basket', description: 'Cotton weave', category: 'Textiles', priceCents: 3000 });
});
test('server field errors map to the amount, retain the draft and allow correction', async () => {
  await render({ onSubmit: jest.fn(), error: { message: 'Please check the highlighted fields.', fields: { priceCents: 'Invalid price.' } } });
  expect(field('priceAud').getAttribute('aria-describedby')).toContain('product-price-error');
  expect(container.textContent).toContain('Invalid price.'); expect(field('title').value).toBe('Basket');
});
test('saving and an archive conflict disable writes without clearing input', async () => {
  const onSubmit = jest.fn(); await render({ onSubmit, saving: true }); submit();
  expect(onSubmit).not.toHaveBeenCalled(); expect(field('title').disabled).toBe(true);
  await render({ onSubmit, locked: true }); submit();
  expect(onSubmit).not.toHaveBeenCalled(); expect(field('priceAud').value).toBe('25.00');
});
