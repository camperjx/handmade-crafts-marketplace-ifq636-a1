import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { archiveProduct, listMyProducts } from '../api/productApi';
import useProductResource from '../hooks/useProductResource';
import useProductMutation from '../hooks/useProductMutation';
import ProductSession from '../components/products/ProductSession';
import ProductReadState from '../components/products/ProductReadState';
import ProductCard from '../components/products/ProductCard';

function MyProducts() {
  const location = useLocation();
  const navigate = useNavigate();
  const resource = useProductResource(listMyProducts);
  const mutation = useProductMutation();
  const [notice, setNotice] = useState(location.state?.productNotice || '');
  const [confirmId, setConfirmId] = useState(null);
  const heading = useRef(null);
  const cancel = useRef(null);
  const trigger = useRef(null);
  const selected = resource.data?.find(product => product.id === confirmId);
  useEffect(() => {
    if (location.state?.productNotice) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);
  useEffect(() => { if (confirmId) cancel.current?.focus(); }, [confirmId]);
  function closeConfirmation() { setConfirmId(null); trigger.current?.focus(); }
  async function confirmArchive() {
    const result = await mutation.run(options => archiveProduct(confirmId, options));
    if (result.ok) {
      setConfirmId(null); setNotice('Product archived. It remains in your history.');
      await resource.reload(); heading.current?.focus();
    }
  }
  async function refreshAfterConflict() {
    setConfirmId(null); mutation.clearError(); await resource.reload(); heading.current?.focus();
  }
  return <section>
    <header className="product-toolbar workspace-header"><div><p className="eyebrow">Your maker workspace</p><h1 ref={heading} tabIndex={-1}>My products</h1><p className="muted">Manage your listings and keep a history of archived work.</p></div><Link className="button" to="/seller/products/new">Create product</Link></header>
    {notice && <p className="feedback success" role="status">{notice}</p>}
    {mutation.error && <div className="feedback error" role="alert"><p>{mutation.error.message}</p>{mutation.error.uncertain && <p>Check the latest product status before trying again.</p>}<button className="text-button" onClick={refreshAfterConflict}>Reload My products</button></div>}
    {selected && <section className="archive-confirmation" role="group" aria-labelledby="archive-title" onKeyDown={event => { if (event.key === 'Escape' && !mutation.pending) { event.stopPropagation(); closeConfirmation(); } }}>
      <h2 id="archive-title">Archive this product?</h2><p><strong>{selected.title}</strong> will leave the public catalogue. Its record will be retained. Archived products cannot be edited or reopened.</p>
      <div className="actions"><button ref={cancel} className="button secondary" type="button" disabled={mutation.pending} onClick={closeConfirmation}>Cancel archive</button><button className="button" type="button" disabled={mutation.pending || Boolean(mutation.error)} onClick={confirmArchive}>{mutation.pending ? 'Archiving…' : 'Confirm archive'}</button></div>
    </section>}
    <div className="product-toolbar"><p className="muted">Your active and archived listings</p><button className="button secondary compact" disabled={resource.loading || mutation.pending || Boolean(confirmId)} onClick={resource.reload}>Reload My products</button></div>
    <ProductReadState resource={resource}>{resource.data?.length ? <div className="product-grid">{resource.data.map(product => <ProductCard key={product.id} product={product}>
      {product.status === 'active' && <><Link to={`/seller/products/${product.id}/edit`}>Edit</Link><button className="text-button inline" type="button" disabled={mutation.pending} onClick={event => { trigger.current = event.currentTarget; mutation.clearError(); setNotice(''); setConfirmId(product.id); }}>Archive</button></>}
    </ProductCard>)}</div> : <div className="product-state"><h2>You have not published any products yet.</h2><p className="muted">Start with a clear description and a price in AUD.</p><Link className="button" to="/seller/products/new">Publish your first product</Link></div>}</ProductReadState>
  </section>;
}

export default function SellerProducts() { return <ProductSession><MyProducts /></ProductSession>; }
