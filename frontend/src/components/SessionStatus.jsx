import { useAuth } from '../context/AuthContext';
export default function SessionStatus() {
  const { status, sessionMessage, refreshSession, logout } = useAuth();
  if (status === 'initializing') return <section className="status-panel" role="status"><h1>Checking your sign-in…</h1><p>Please wait a moment.</p><button className="button secondary" onClick={() => logout()}>Sign in again</button></section>;
  return <section className="status-panel" role="alert"><h1>We could not confirm your sign-in</h1><p>{sessionMessage}</p><div className="actions"><button className="button" onClick={refreshSession}>Try again</button><button className="button secondary" onClick={() => logout()}>Sign in again</button></div></section>;
}
