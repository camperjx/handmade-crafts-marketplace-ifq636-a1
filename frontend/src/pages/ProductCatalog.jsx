import { Link } from 'react-router-dom';
import { listProducts } from '../api/productApi';
import { useAuth } from '../context/AuthContext';
import useProductResource from '../hooks/useProductResource';
import ProductSession from '../components/products/ProductSession';
import ProductReadState from '../components/products/ProductReadState';
import ProductCard from '../components/products/ProductCard';

function Catalogue() {
  const { user } = useAuth();
  const resource = useProductResource(listProducts);
  return <section>
    <header className="marketplace-intro product-hero"><div><p className="eyebrow">Thoughtfully made. Individually crafted.</p><h1>Explore handmade products</h1><p>Discover original work and the details that make each piece special.</p></div><span className="hero-emblem" aria-hidden="true">h</span></header>
    <div className="product-toolbar"><div><h2>The collection</h2><p className="muted">Active listings from our makers · Prices in AUD</p></div><div className="actions"><button className="button secondary compact" disabled={resource.loading} onClick={resource.reload}>Reload products</button>{user?.role === 'seller' && <Link className="button compact" to="/seller/products">My products</Link>}</div></div>
    <ProductReadState resource={resource}>
      {resource.data?.length ? <div className="product-grid">{resource.data.map(product => <ProductCard key={product.id} product={product} />)}</div> : <div className="product-state"><h3>No products are available yet.</h3><p className="muted">Our makers are preparing their listings. Come back soon.</p>{user?.role === 'seller' && <Link className="button" to="/seller/products/new">Create product</Link>}</div>}
    </ProductReadState>
  </section>;
}

export default function ProductCatalog() { return <ProductSession><Catalogue /></ProductSession>; }
