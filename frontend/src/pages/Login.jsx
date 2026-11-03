import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import FormField from '../components/FormField';
import { postLoginPath } from '../utils/roleHome';
import { formError } from '../utils/formError';
export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState({ message: '', fields: {} });
  const { login, sessionMessage } = useAuth();
  const navigate = useNavigate(); const location = useLocation();
  const change = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); if (submitting) return;
    setSubmitting(true); setError({ message: '', fields: {} });
    try {
      const account = await login(form);
      if (account) navigate(postLoginPath(account.role, location.state?.from?.pathname), { replace: true });
    } catch (failure) { setError(formError(failure, 'We could not sign you in. Please try again.')); }
    finally { setSubmitting(false); }
  }
  return <AuthLayout><p className="eyebrow">Your marketplace account</p><h2>Welcome back</h2><p className="muted">Sign in to continue to your marketplace.</p>
    {location.state?.registered && <p className="feedback success" role="status">Your account is ready. Please sign in.</p>}
    {sessionMessage && <p className="feedback info" role="status">{sessionMessage}</p>}
    <form onSubmit={submit} aria-label="Sign in">
      <FormField id="login-email" label="Email" name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={change} error={error.fields.email} disabled={submitting} />
      <FormField id="login-password" label="Password" name="password" type="password" autoComplete="current-password" required value={form.password} onChange={change} error={error.fields.password} disabled={submitting} />
      {error.message && <div className="feedback error" role="alert">{error.message}</div>}
      <button className="button full" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
    </form><p className="form-footer">New here? <Link to="/register">Create an account</Link></p>
  </AuthLayout>;
}
