import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function ProductCatalog() {
  const { user } = useAuth();
  return <section className="marketplace-intro"><p className="eyebrow">The handmade marketplace</p><h1>Explore handmade products</h1><p>Made with time, skill and care. A place to connect with independent makers.</p><Link className="button" to={user ? '/profile' : '/login'}>{user ? 'Your account' : 'Sign in to your account'}</Link></section>;
}
