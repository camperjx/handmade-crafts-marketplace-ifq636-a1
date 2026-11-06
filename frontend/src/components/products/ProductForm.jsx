import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FormField from '../FormField';
import { productFormValues, validateProductForm } from '../../utils/productForm';

export default function ProductForm({ product, mode, onSubmit, saving, error, locked = false }) {
  const [values, setValues] = useState(() => productFormValues(product));
  const [localErrors, setLocalErrors] = useState({});
  const form = useRef(null);
  const fields = { ...error?.fields, ...localErrors };
  const disabled = saving || locked;
  function change(event) {
    const { name, value } = event.target;
    setValues(previous => ({ ...previous, [name]: value }));
    const field = name === 'priceAud' ? 'priceCents' : name;
    setLocalErrors(previous => ({ ...previous, [field]: '' }));
  }
  function submit(event) {
    event.preventDefault();
    if (disabled) return;
    const checked = validateProductForm(values);
    setLocalErrors(checked.fields);
    if (!checked.valid) {
      const first = Object.keys(checked.fields)[0];
      form.current.elements.namedItem(first === 'priceCents' ? 'priceAud' : first)?.focus();
      return;
    }
    onSubmit(checked.payload);
  }
  return <form ref={form} className="product-form" aria-label={mode === 'create' ? 'Publish product' : 'Edit product'} noValidate onSubmit={submit}>
    <FormField id="product-title" name="title" label="Title" hint="A clear name, up to 120 characters." required value={values.title} onChange={change} error={fields.title} disabled={disabled} />
    <div className="field"><label htmlFor="product-description">Description</label>
      <textarea id="product-description" name="description" required rows={6} value={values.description} onChange={change} disabled={disabled} aria-invalid={Boolean(fields.description)} aria-describedby={`product-description-hint${fields.description ? ' product-description-error' : ''}`} />
      <p className="field-hint" id="product-description-hint">Describe the craft, materials and details. Up to 2000 characters.</p>
      {fields.description && <p className="field-error" id="product-description-error">{fields.description}</p>}
    </div>
    <div className="product-form-row">
      <FormField id="product-category" name="category" label="Category" hint="For example, ceramics or textiles. Up to 60 characters." required value={values.category} onChange={change} error={fields.category} disabled={disabled} />
      <FormField id="product-price" name="priceAud" label="Price (AUD)" inputMode="decimal" type="text" hint="Enter dollars, for example 25.00." required value={values.priceAud} onChange={change} error={fields.priceCents} disabled={disabled} />
    </div>
    {error && <div className="feedback error" role="alert"><p>{error.message}</p>{fields._form && <p>{fields._form}</p>}{error.uncertain && <Link to="/seller/products">Check My products</Link>}</div>}
    {Object.values(localErrors).some(Boolean) && <p className="feedback error" role="alert">Please check the highlighted fields.</p>}
    <div className="actions"><button className="button" type="submit" disabled={disabled}>{saving ? 'Saving…' : mode === 'create' ? 'Publish product' : 'Save changes'}</button>
      {saving ? <span className="muted" role="status">Waiting for confirmation…</span> : <Link className="button secondary" to="/seller/products">Cancel</Link>}
    </div>
  </form>;
}
