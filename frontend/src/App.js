import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import SessionStatus from './components/SessionStatus';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import ProductCatalog from './pages/ProductCatalog';
import SellerProducts from './pages/SellerProducts';
import { useAuth } from './context/AuthContext';
import { postLoginPath, roleHome } from './utils/roleHome';
import './App.css';
function RootRedirect() {
  const { status, user } = useAuth();
  if (status === 'initializing' || status === 'unavailable') return <SessionStatus />;
  return <Navigate to={roleHome(user?.role)} replace />;
}
function AuthEntry({ children }) {
  const { status, user } = useAuth(); const location = useLocation();
  if (status === 'initializing' || status === 'unavailable') return <SessionStatus />;
  if (status === 'authenticated') return <Navigate to={postLoginPath(user.role, location.state?.from?.pathname)} replace />;
  return children;
}
function NotFound() { return <section className="status-panel"><h1>Page not found</h1><p>Return to the marketplace to continue.</p><Link className="button" to="/">Back to marketplace</Link></section>; }
export default function App() {
  const { status, sessionMessage } = useAuth();
  return <BrowserRouter><Navbar /><main id="main-content">{status === 'authenticated' && sessionMessage && <p className="feedback info" role="status">{sessionMessage}</p>}<Routes>
    <Route path="/" element={<RootRedirect />} />
    <Route path="/login" element={<AuthEntry><Login /></AuthEntry>} />
    <Route path="/register" element={<AuthEntry><Register /></AuthEntry>} />
    <Route path="/products" element={<ProductCatalog />} />
    <Route path="/seller/products" element={<ProtectedRoute><RoleRoute allowedRoles={['seller']}><SellerProducts /></RoleRoute></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes></main><footer className="site-footer">Made by people. Chosen with care.</footer></BrowserRouter>;
}
