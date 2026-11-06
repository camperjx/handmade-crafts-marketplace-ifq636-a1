import { Link } from 'react-router-dom';

export default function ProductReadState({ resource, children }) {
  if (resource.loading) return <div className="product-state" role="status"><span className="eyebrow">One moment</span><p>Loading products…</p></div>;
  if (resource.error) {
    const { status, message } = resource.error;
    const unavailable = status === 404;
    const invalid = status === 400;
    return <section className="product-state feedback error" role="alert">
      <h2>{unavailable ? 'Product not available' : invalid ? 'Invalid product link' : status === 403 ? 'You do not have access' : 'We could not load products'}</h2>
      <p>{message}</p><div className="actions">
        {!unavailable && !invalid && <button className="button secondary" onClick={resource.reload}>Retry</button>}
        <Link to="/products">Back to products</Link>
      </div>
    </section>;
  }
  return children;
}
