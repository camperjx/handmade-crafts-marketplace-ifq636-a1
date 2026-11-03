import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../axiosConfig';
import FormField from '../components/FormField';
import { formError } from '../utils/formError';
const fieldsFrom = account => ({ name: account.name, email: account.email, address: account.address || '' });
export default function Profile() {
  const { user, updateUser, getRevision } = useAuth();
  const [form, setForm] = useState(() => fieldsFrom(user));
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [error, setError] = useState({ message: '', fields: {} }); const [success, setSuccess] = useState('');
  const reader = useRef(null); const writer = useRef(null);
  const load = useCallback(async () => {
    reader.current?.abort(); const controller = new AbortController(); reader.current = controller;
    const revision = getRevision(); setLoading(true); setError({ message: '', fields: {} });
    try {
      const response = await axiosInstance.get('/api/auth/profile', { signal: controller.signal });
      if (!controller.signal.aborted && updateUser(response.data, revision)) setForm(fieldsFrom(response.data));
    } catch (failure) {
      if (!controller.signal.aborted && getRevision() === revision) setError(formError(failure, 'We could not load your profile. Please try again.'));
    } finally { if (!controller.signal.aborted && getRevision() === revision) setLoading(false); }
  }, [getRevision, updateUser]);
  useEffect(() => { load(); return () => { reader.current?.abort(); writer.current?.abort(); }; }, [load, user.id]);
  const change = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); if (saving) return;
    const controller = new AbortController(); writer.current = controller; const revision = getRevision();
    setSaving(true); setError({ message: '', fields: {} }); setSuccess('');
    try {
      const response = await axiosInstance.put('/api/auth/profile', form, { signal: controller.signal });
      if (!controller.signal.aborted && updateUser(response.data, revision)) { setForm(fieldsFrom(response.data)); setSuccess('Your profile has been saved.'); }
    } catch (failure) {
      if (!controller.signal.aborted && getRevision() === revision) setError(formError(failure, 'We could not save your profile. Please try again.'));
    } finally { if (!controller.signal.aborted && getRevision() === revision) setSaving(false); }
  }
  return <section className="profile-layout"><header><p className="eyebrow">Your account</p><h1>Your profile</h1><p className="muted">Keep your details up to date.</p><span className="role-badge">{user.role === 'seller' ? 'Seller' : 'Buyer'} account</span></header><div className="profile-card">
    {loading ? <p role="status">Loading your profile…</p> : <form onSubmit={submit} aria-label="Update profile">
      <FormField id="profile-name" name="name" label="Name" autoComplete="name" required maxLength={80} value={form.name} onChange={change} error={error.fields.name} disabled={saving} />
      <FormField id="profile-email" name="email" label="Email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={change} error={error.fields.email} disabled={saving} />
      <FormField id="profile-address" name="address" label="Address (optional)" autoComplete="street-address" maxLength={300} value={form.address} onChange={change} error={error.fields.address} disabled={saving} />
      {error.message && <div className="feedback error" role="alert">{error.message}<button className="text-button" type="button" onClick={load}>Reload profile</button></div>}
      {success && <p className="feedback success" role="status">{success}</p>}
      <button className="button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
    </form>}
  </div></section>;
}
