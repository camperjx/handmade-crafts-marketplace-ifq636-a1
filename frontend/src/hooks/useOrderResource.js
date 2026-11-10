import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { orderFailure } from '../utils/orderForm';
export default function useOrderResource(loader) {
  const { getRevision } = useAuth();
  const reader = useRef(null);
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const reload = useCallback(async () => {
    reader.current?.abort(); const controller = new AbortController(); reader.current = controller;
    const revision = getRevision();
    const current = () => !controller.signal.aborted && reader.current === controller && revision === getRevision();
    setState({ loading: true, data: null, error: null });
    try {
      const value = await loader({ signal: controller.signal });
      if (current()) { setState({ loading: false, data: value, error: null }); return { ok: true, value }; }
    } catch (error) {
      if (current()) setState({ loading: false, data: null, error: orderFailure(error, 'We could not load this request. Please try again.') });
    }
    return { ok: false };
  }, [getRevision, loader]);
  useEffect(() => { reload(); return () => reader.current?.abort(); }, [reload]);
  return { ...state, reload };
}
