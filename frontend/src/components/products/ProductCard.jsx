import { Link } from 'react-router-dom';
import { formatAud } from '../../utils/productMoney';

export default function ProductCard({ product, children }) {
  return <article className="product-card" aria-label={product.title}>
    <div className="craft-placeholder" aria-hidden="true"><span>{product.category.slice(0, 1).toUpperCase()}</span><small>Made by hand</small></div>
    <div className="product-card-content">
      <div className="product-card-meta"><span>{product.category}</span><span className={`product-badge ${product.status}`}>{product.status === 'archived' ? 'Archived' : 'Active'}</span></div>
      <h2><Link to={`/products/${product.id}`}>{product.title}</Link></h2>
      <p className="product-price">{formatAud(product.priceCents)}</p>
      <p className="product-excerpt">{product.description}</p>
      <div className="actions product-card-actions"><Link to={`/products/${product.id}`}>View details</Link>{children}</div>
    </div>
  </article>;
}
