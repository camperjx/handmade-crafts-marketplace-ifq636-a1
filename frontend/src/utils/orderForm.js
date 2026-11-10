export function validateOrderQuantity(input, unitPriceCents) {
  if (typeof input !== 'string' || !/^\d+$/.test(input.trim())) return { error: 'Enter a whole quantity from 1 to 100.' };
  const quantity = Number(input.trim());
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) return { error: 'Enter a whole quantity from 1 to 100.' };
  const totalCents = unitPriceCents * quantity;
  if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents <= 0 || !Number.isSafeInteger(totalCents) || totalCents <= 0) return { error: 'This quantity produces an unsupported total.' };
  return { quantity, totalCents };
}
export function orderFailure(error, fallback) {
  return { status: error.response?.status || 0, code: error.response?.data?.code || '', message: error.response?.data?.message || fallback,
    fields: error.response?.data?.errors || {}, uncertain: !error.response };
}
