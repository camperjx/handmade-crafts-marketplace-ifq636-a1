import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { productFailure } from '../utils/productForm';

export default function useProductMutation() {
  const { getRevision } = useAuth();
  const writer = useRef(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => () => writer.current?.abort(), []);
  const run = useCallback(async operation => {
    if (writer.current) return { ok: false };
    const controller = new AbortController();
    writer.current = controller;
    const revision = getRevision();
    const current = () => !controller.signal.aborted && writer.current === controller && getRevision() === revision;
    setPending(true); setError(null);
    try {
      const value = await operation({ signal: controller.signal });
      return current() ? { ok: true, value } : { ok: false };
    } catch (failure) {
      if (current()) setError(productFailure(failure, 'We could not confirm the result. Check My products before submitting again.'));
      return { ok: false };
    } finally {
      if (current()) setPending(false);
      if (writer.current === controller) writer.current = null;
    }
  }, [getRevision]);
  return { run, pending, error, clearError: () => setError(null) };
}
