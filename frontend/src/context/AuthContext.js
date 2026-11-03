import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axiosInstance from '../axiosConfig';
import { createAuthSession } from '../auth/authSession';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [snapshot, setSnapshot] = useState({ status: 'initializing', user: null, sessionMessage: '' });
  const session = useMemo(() => createAuthSession(axiosInstance, setSnapshot), []);
  useEffect(() => { session.start(); return () => session.stop(); }, [session]);
  const value = { ...snapshot, login: session.login, logout: session.logout, refreshSession: session.refreshSession, updateUser: session.updateUser, getRevision: session.getRevision };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requires AuthProvider.');
  return context;
}
