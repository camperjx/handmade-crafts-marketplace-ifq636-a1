import { Link } from 'react-router-dom';
export default function OrderReadState({ resource, children, backTo = '/orders' }) {
  if (resource.loading) return <div className="product-state" role="status">Loading request information…</div>;
  if (resource.error) {
    const { status, message } = resource.error;
    return <section className="product-state feedback error" role="alert"><h2>{status === 403 ? 'You do not have access to this request' : status === 404 ? 'Request or product not available' : status === 400 ? 'Invalid request link' : 'We could not load requests'}</h2><p>{message}</p><div className="actions">{![400,403,404].includes(status) && <button className="button secondary" onClick={resource.reload}>Retry</button>}<Link to={backTo}>Back to marketplace</Link></div></section>;
  }
  return children;
}
