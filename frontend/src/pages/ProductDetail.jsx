import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProduct } from '../api/productApi';
import { useAuth } from '../context/AuthContext';
import useProductResource from '../hooks/useProductResource';
import ProductSession from '../components/products/ProductSession';
import ProductReadState from '../components/products/ProductReadState';
import { formatAud } from '../utils/productMoney';

function Detail({ id }) {
  const { user } = useAuth();
  const loader = useCallback(options => getProduct(id, options), [id]);
  const resource = useProductResource(loader);
  const product = resource.data;
  const owner = user?.role === 'seller' && product?.sellerId === user.id;
  return <section>
    <Link className="back-link" to={owner ? '/seller/products' : '/products'}>{owner ? '← My products' : '← All products'}</Link>
    <ProductReadState resource={resource}>{product && <div className="product-detail">
      <div className="craft-placeholder detail-placeholder" aria-hidden="true"><span>{product.category.slice(0, 1).toUpperCase()}</span><small>Made by hand</small></div>
      <div className="product-detail-copy"><p className="eyebrow">{product.category}</p><h1>{product.title}</h1><span className={`product-badge ${product.status}`}>{product.status === 'archived' ? 'Archived' : 'Active'}</span><p className="product-price detail-price">{formatAud(product.priceCents)}</p><p className="product-description">{product.description}</p>
        {product.status === 'archived' && <p className="feedback info" role="status">This product is archived. It is retained in your history and cannot be edited or reopened.</p>}
        <div className="actions"><button className="button secondary" onClick={resource.reload}>Reload details</button>{owner && product.status === 'active' && <Link className="button" to={`/seller/products/${product.id}/edit`}>Edit product</Link>}</div>
      </div>
    </div>}</ProductReadState>
  </section>;
}

export default function ProductDetail() {
  const { id } = useParams();
  return <ProductSession resourceKey={id}><Detail id={id} /></ProductSession>;
}
