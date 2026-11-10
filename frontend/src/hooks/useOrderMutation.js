import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { orderFailure } from '../utils/orderForm';
export default function useOrderMutation() {
  const { getRevision } = useAuth(); const writer = useRef(null);
  const [pending, setPending] = useState(false), [error, setError] = useState(null);
  useEffect(() => () => writer.current?.abort(), []);
  const run = useCallback(async operation => {
    if (writer.current) return { ok: false };
    const controller = new AbortController(); writer.current = controller; const revision = getRevision();
    const current = () => !controller.signal.aborted && writer.current === controller && revision === getRevision();
    setPending(true); setError(null);
    try { const value = await operation({ signal: controller.signal }); return current() ? { ok: true, value } : { ok: false }; }
    catch (failure) {
      if (current()) {
        const details = orderFailure(failure, 'We could not save this request.');
        if (details.uncertain || details.status >= 500) {
          details.uncertain = true; details.message = 'We could not confirm the result. Check your saved requests before submitting again.';
        }
        setError(details); return { ok: false, error: details };
      }
      return { ok: false };
    } finally { if (current()) setPending(false); if (writer.current === controller) writer.current = null; }
  }, [getRevision]);
  return { run, pending, error, clearError: () => setError(null) };
}
