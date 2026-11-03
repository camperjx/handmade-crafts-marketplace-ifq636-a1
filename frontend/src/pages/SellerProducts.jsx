import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function SellerProducts() {
  const { user } = useAuth();
  return <section className="marketplace-intro"><p className="eyebrow">Your maker space</p><h1>My products</h1><p>Welcome, {user.name}. Your handmade work, all in one place.</p><span className="role-badge">Seller account</span><div><Link className="button secondary" to="/profile">Manage your profile</Link></div></section>;
}
