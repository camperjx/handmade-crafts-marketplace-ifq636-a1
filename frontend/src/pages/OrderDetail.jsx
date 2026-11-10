import { useCallback, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getOrder, updateOrderStatus } from '../api/orderApi';
import { useAuth } from '../context/AuthContext';
import { formatAud } from '../utils/productMoney';
import useOrderResource from '../hooks/useOrderResource';
import useOrderMutation from '../hooks/useOrderMutation';
import OrderSession from '../components/orders/OrderSession';
import OrderReadState from '../components/orders/OrderReadState';
import OrderStatusBadge from '../components/orders/OrderStatusBadge';
function Detail({ id }) {
  const loader = useCallback(options => getOrder(id, options), [id]);
  const resource=useOrderResource(loader), mutation=useOrderMutation();
  const {user}=useAuth(); const location=useLocation();
  const [notice,setNotice]=useState(location.state?.orderNotice || ''), [locked,setLocked]=useState(false), [rejecting,setRejecting]=useState(false);
  const order=resource.data, seller=user.role==='seller' && order?.sellerId===user.id;
  const backTo=user.role==='seller'?'/seller/orders':'/orders';
  async function reloadLatest() {
    const result=await resource.reload();
    if(result.ok){mutation.clearError();setLocked(false);setRejecting(false);}
    return result;
  }
  async function change(status) {
    if(locked || mutation.pending) return;
    setNotice(''); const result=await mutation.run(options=>updateOrderStatus(id,{status,expectedStatus:order.status},options));
    setRejecting(false);
    if(result.ok){setLocked(true);setNotice('Request status saved.');await reloadLatest();}
    else if(result.error?.status===409){setLocked(true);const fresh=await reloadLatest();if(fresh.ok)setNotice('This request changed before your action was saved. The latest status has been loaded. Review it before continuing.');}
    else if(result.error?.uncertain)setLocked(true);
  }
  return <section className="editor-layout"><header><Link className="back-link" to={backTo}>← {user.role==='seller'?'Sales requests':'My requests'}</Link><p className="eyebrow">Made-to-order request</p><h1>Request details</h1></header>
    {notice && <p className="feedback success" role="status">{notice}</p>}
    {mutation.error && <div className="feedback error" role="alert"><p>{mutation.error.message}</p><button className="button secondary" onClick={reloadLatest}>Reload request</button></div>}
    <OrderReadState resource={{...resource,reload:reloadLatest}} backTo={backTo}>{order && <article className="product-editor-card"><OrderStatusBadge status={order.status} /><h2>{order.productTitle}</h2><p className="field-hint">Request ID: {order.id}</p>
      <dl className="order-facts"><dt>Quantity</dt><dd>{order.quantity}</dd><dt>Unit price at request</dt><dd>{formatAud(order.unitPriceCents)}</dd><dt>Saved total</dt><dd>{formatAud(order.totalCents)}</dd><dt>Created</dt><dd>{new Date(order.createdAt).toLocaleString()}</dd><dt>Updated</dt><dd>{new Date(order.updatedAt).toLocaleString()}</dd></dl><p className="muted">No payment has been taken. Product changes do not alter these saved details.</p>
      <div className="actions"><button className="button secondary" disabled={mutation.pending} onClick={reloadLatest}>Reload request</button>{seller && order.status==='pending' && <><button className="button" disabled={locked || mutation.pending} onClick={()=>change('accepted')}>Accept request</button><button className="button secondary" disabled={locked || mutation.pending} onClick={()=>setRejecting(true)}>Reject request</button></>}{seller && order.status==='accepted' && <button className="button" disabled={locked || mutation.pending} onClick={()=>change('completed')}>Mark completed</button>}</div>
      {rejecting && <div className="feedback info" role="group" aria-label="Confirm rejection"><p>Reject this request? This decision cannot be reopened.</p><div className="actions"><button className="button secondary" disabled={mutation.pending} onClick={()=>setRejecting(false)}>Cancel rejection</button><button className="button" disabled={locked || mutation.pending} onClick={()=>change('rejected')}>Confirm rejection</button></div></div>}
      {['completed','rejected'].includes(order.status) && <p className="feedback info">This request is closed and cannot be reopened.</p>}
    </article>}</OrderReadState>
  </section>;
}
export default function OrderDetail(){const {id}=useParams();return <OrderSession resourceKey={id}><Detail id={id}/></OrderSession>;}
