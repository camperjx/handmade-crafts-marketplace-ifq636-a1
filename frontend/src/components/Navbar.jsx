import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function Navbar() {
  const { user, status, logout } = useAuth(); const navigate = useNavigate();
  function signOut() { logout(); navigate('/login', { replace: true }); }
  return <header className="site-header"><a className="skip-link" href="#main-content">Skip to content</a><Link className="brand" to="/"><span className="brand-mark" aria-hidden="true">h</span><span>Handmade Crafts<br /><small>Marketplace</small></span></Link><nav aria-label="Main navigation">
    <NavLink to="/products">Browse products</NavLink>
    {status === 'authenticated' ? <>{user.role === 'seller' && <NavLink to="/seller/products">My products</NavLink>}<NavLink to="/profile">Profile</NavLink><span className="nav-role">{user.role === 'seller' ? 'Seller' : 'Buyer'}</span><button className="button secondary compact" onClick={signOut}>Sign out</button></> : status === 'anonymous' ? <><NavLink to="/login">Sign in</NavLink><Link className="button compact" to="/register">Create account</Link></> : <span className="muted">Checking sign-in</span>}
  </nav></header>;
}
