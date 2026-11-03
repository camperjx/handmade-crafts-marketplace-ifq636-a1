import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import AuthLayout from '../components/AuthLayout';
import FormField from '../components/FormField';
import { formError } from '../utils/formError';
export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'buyer' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState({ message: '', fields: {} });
  const navigate = useNavigate();
  const change = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); if (submitting) return;
    setSubmitting(true); setError({ message: '', fields: {} });
    try {
      await axiosInstance.post('/api/auth/register', form);
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (failure) { setError(formError(failure, 'We could not create your account. Please try again.')); }
    finally { setSubmitting(false); }
  }
  return <AuthLayout><p className="eyebrow">Join the marketplace</p><h2>Create your account</h2><p className="muted">Choose how you would like to take part.</p>
    <form onSubmit={submit} aria-label="Create account">
      <fieldset className="role-choice" disabled={submitting}><legend>Account role</legend>{['buyer', 'seller'].map(role => <label key={role} className={form.role === role ? 'selected' : ''}><input type="radio" name="role" value={role} checked={form.role === role} onChange={change} /><span>{role === 'buyer' ? 'Buyer' : 'Seller'}</span></label>)}</fieldset>
      {error.fields.role && <p className="field-error">{error.fields.role}</p>}
      <FormField id="register-name" label="Name" name="name" autoComplete="name" required maxLength={80} value={form.name} onChange={change} error={error.fields.name} disabled={submitting} />
      <FormField id="register-email" label="Email" name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={change} error={error.fields.email} disabled={submitting} />
      <FormField id="register-password" label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={change} error={error.fields.password} hint="Use at least 8 characters. Very long passwords may exceed the supported size." disabled={submitting} />
      {error.message && <div className="feedback error" role="alert">{error.message}{error.fields._form && <p>{error.fields._form}</p>}</div>}
      <button className="button full" type="submit" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'}</button>
    </form><p className="form-footer">Already have an account? <Link to="/login">Sign in</Link></p>
  </AuthLayout>;
}
