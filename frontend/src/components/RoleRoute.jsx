import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleHome } from '../utils/roleHome';
export default function RoleRoute({ allowedRoles, children }) {
  const { user } = useAuth();
  if (!user || !allowedRoles.includes(user.role)) return <section className="status-panel" role="alert"><p className="eyebrow">Account access</p><h1>You do not have access to this page</h1><p>Return to your marketplace home to continue.</p><Link className="button" to={roleHome(user?.role)}>Back to marketplace</Link></section>;
  return children;
}
