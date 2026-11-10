import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getProduct } from '../api/productApi';
import { createOrder } from '../api/orderApi';
import { formatAud } from '../utils/productMoney';
import { validateOrderQuantity } from '../utils/orderForm';
import useOrderResource from '../hooks/useOrderResource';
import useOrderMutation from '../hooks/useOrderMutation';
import OrderSession from '../components/orders/OrderSession';
import OrderReadState from '../components/orders/OrderReadState';
import FormField from '../components/FormField';
function RequestForm({ id }) {
  const loader = useCallback(options => getProduct(id, options), [id]);
  const resource = useOrderResource(loader), mutation = useOrderMutation();
  const [quantity, setQuantity] = useState('1'), [fieldError, setFieldError] = useState('');
  const navigate = useNavigate(); const product = resource.data;
  const checked = product ? validateOrderQuantity(quantity, product.priceCents) : {};
  const locked = mutation.pending || mutation.error?.uncertain || mutation.error?.status === 409;
  async function submit(event) {
    event.preventDefault(); if (locked) return;
    const values = validateOrderQuantity(quantity, product.priceCents); setFieldError(values.error || '');
    if (values.error) return;
    const result = await mutation.run(options => createOrder({ productId: id, quantity: values.quantity }, options));
    if (result.ok) navigate(`/orders/${result.value.id}`, { replace: true, state: { orderNotice: 'Request saved. No payment has been taken.' } });
  }
  return <section className="editor-layout"><header><Link className="back-link" to={`/products/${id}`}>← Product details</Link><p className="eyebrow">Made for you</p><h1>Request this item</h1><p className="muted">This is a made-to-order request. No payment is taken.</p></header>
    <OrderReadState resource={resource} backTo="/products">{product && <div className="product-editor-card"><h2>{product.title}</h2><p>Unit price: {formatAud(product.priceCents)}</p><p className="muted">The server confirms the price and total when the request is saved.</p>
      {mutation.error && <div className="feedback error" role="alert"><p>{mutation.error.message}</p><Link to="/orders">Check My requests</Link>{mutation.error.status === 409 && <p>This listing can no longer receive this request. Return to the catalogue.</p>}</div>}
      <form onSubmit={submit} noValidate><FormField id="request-quantity" label="Quantity" type="text" inputMode="numeric" value={quantity} disabled={Boolean(locked)} onChange={event => {setQuantity(event.target.value);setFieldError('');}} hint="Enter a whole number from 1 to 100." error={fieldError || mutation.error?.fields.quantity} />
        <p className="order-total">Estimated total: {checked.totalCents ? formatAud(checked.totalCents) : 'Check quantity'}</p><div className="actions"><button className="button" type="submit" disabled={Boolean(locked)}>{mutation.pending ? 'Submitting…' : 'Submit request'}</button><Link to="/orders">My requests</Link></div></form>
    </div>}</OrderReadState>
  </section>;
}
export default function OrderRequestForm() { const {id}=useParams();return <OrderSession resourceKey={id}><RequestForm id={id} /></OrderSession>; }
