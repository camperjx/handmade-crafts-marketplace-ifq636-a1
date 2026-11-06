import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createProduct, getProduct, updateProduct } from '../api/productApi';
import { useAuth } from '../context/AuthContext';
import useProductResource from '../hooks/useProductResource';
import useProductMutation from '../hooks/useProductMutation';
import ProductSession from '../components/products/ProductSession';
import ProductReadState from '../components/products/ProductReadState';
import ProductForm from '../components/products/ProductForm';

function Editor({ id, mode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const loader = useCallback(options => mode === 'edit' ? getProduct(id, options) : Promise.resolve(null), [id, mode]);
  const resource = useProductResource(loader);
  const mutation = useProductMutation();
  const product = resource.data;
  const conflict = mutation.error?.status === 409;
  async function save(values) {
    const result = await mutation.run(async options => {
      try { return mode === 'create' ? await createProduct(values, options) : await updateProduct(id, values, options); }
      catch (error) {
        if (error.response?.status === 409) {
          try { error.latestProduct = await getProduct(id, options); } catch { /* Keep the original conflict if the latest read fails. */ }
        }
        throw error;
      }
    });
    if (result.ok) navigate('/seller/products', { replace: true, state: { productNotice: mode === 'create' ? 'Product published.' : 'Product updated.' } });
  }
  function reloadLatest() { mutation.clearError(); resource.reload(); }
  return <section className="editor-layout">
    <header><Link className="back-link" to="/seller/products">← My products</Link><p className="eyebrow">Your maker workspace</p><h1>{mode === 'create' ? 'Create product' : 'Edit product'}</h1><p className="muted">{mode === 'create' ? 'Tell the story of your craft. Your listing becomes public when you publish.' : 'Keep your listing accurate. Buyers will see the saved changes on their next read.'}</p></header>
    <ProductReadState resource={resource}>
      {mode === 'edit' && product && product.sellerId !== user.id ? <div className="product-state" role="alert"><h2>You do not have access to edit this product</h2><p>Only the owner can update or archive it.</p><Link to="/seller/products">Back to My products</Link></div>
        : mode === 'edit' && product?.status === 'archived' ? <div className="product-state" role="status"><h2>This product is archived</h2><p>Archived products are read-only and cannot be reopened.</p><Link to={`/products/${product.id}`}>View archived product</Link></div>
          : <div className="product-editor-card">
            {conflict && <div className="feedback info" role="status"><p>The product changed while you were editing. Your draft is kept below; saving is disabled.</p>{mutation.error.latestProduct && <p>Latest status: {mutation.error.latestProduct.status}.</p>}<button className="button secondary" type="button" onClick={reloadLatest}>Discard draft and reload latest</button></div>}
            <ProductForm key={product?.updatedAt || 'new'} product={product} mode={mode} onSubmit={save} saving={mutation.pending} error={mutation.error} locked={conflict} />
          </div>}
    </ProductReadState>
  </section>;
}

export default function ProductEditor({ mode }) {
  const { id } = useParams();
  return <ProductSession resourceKey={`${mode}:${id || ''}`}><Editor id={id} mode={mode} /></ProductSession>;
}
