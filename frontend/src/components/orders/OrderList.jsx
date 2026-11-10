import { Link } from 'react-router-dom';
import { listMyOrders, listSellerOrders } from '../../api/orderApi';
import { formatAud } from '../../utils/productMoney';
import useOrderResource from '../../hooks/useOrderResource';
import OrderReadState from './OrderReadState';
import OrderStatusBadge from './OrderStatusBadge';
export default function OrderList({ seller = false }) {
  const resource = useOrderResource(seller ? listSellerOrders : listMyOrders);
  return <section><header className="product-toolbar workspace-header"><div><p className="eyebrow">{seller ? 'Your maker workspace' : 'Your marketplace'}</p><h1>{seller ? 'Sales requests' : 'My requests'}</h1><p className="muted">{seller ? 'Review requests for your work and keep Buyers informed.' : 'Follow the saved status of your made-to-order requests.'}</p></div><button className="button secondary" disabled={resource.loading} onClick={resource.reload}>Reload requests</button></header>
    <OrderReadState resource={resource} backTo={seller ? '/seller/products' : '/products'}>{resource.data?.length ? <div className="product-grid">{resource.data.map(order => <article className="order-card" key={order.id}><OrderStatusBadge status={order.status} /><h2>{order.productTitle}</h2><p>Quantity: {order.quantity}</p><p className="product-price">{formatAud(order.totalCents)}</p><p className="field-hint">Request ID: {order.id}</p><Link to={`/orders/${order.id}`}>View request</Link></article>)}</div> : <div className="product-state"><h2>{seller ? 'No sales requests yet' : 'You have no requests yet'}</h2><p>Requests will appear here after a Buyer saves one.</p><Link className="button" to={seller ? '/seller/products' : '/products'}>{seller ? 'My products' : 'Browse products'}</Link></div>}</OrderReadState>
  </section>;
}
