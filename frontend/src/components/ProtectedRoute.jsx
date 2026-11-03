import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SessionStatus from './SessionStatus';
export default function ProtectedRoute({ children }) {
  const { status } = useAuth(); const location = useLocation();
  if (status === 'initializing' || status === 'unavailable') return <SessionStatus />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: { pathname: location.pathname } }} />;
  return children;
}
