import { cloneElement } from 'react';
import { useAuth } from '../../context/AuthContext';
import SessionStatus from '../SessionStatus';

export default function ProductSession({ children, resourceKey = '' }) {
  const { status, user, getRevision } = useAuth();
  if (status === 'initializing' || status === 'unavailable') return <SessionStatus />;
  // Remount private state even when the same account signs in again.
  return cloneElement(children, { key: `${status}:${user?.id || ''}:${getRevision()}:${resourceKey}` });
}
