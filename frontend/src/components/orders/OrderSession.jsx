import { cloneElement } from 'react';
import { useAuth } from '../../context/AuthContext';
import SessionStatus from '../SessionStatus';
export default function OrderSession({ children, resourceKey = '' }) {
  const { status, user, getRevision } = useAuth();
  if (status === 'initializing' || status === 'unavailable') return <SessionStatus />;
  return cloneElement(children, { key: `${status}:${user?.id || ''}:${getRevision()}:${resourceKey}` });
}
