import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { productFailure } from '../utils/productForm';

export default function useProductResource(loader) {
  const { getRevision } = useAuth();
  const reader = useRef(null);
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const reload = useCallback(async () => {
    reader.current?.abort();
    const controller = new AbortController();
    reader.current = controller;
    const revision = getRevision();
    const current = () => !controller.signal.aborted && reader.current === controller && getRevision() === revision;
    setState({ loading: true, data: null, error: null });
    try {
      const data = await loader({ signal: controller.signal });
      if (current()) setState({ loading: false, data, error: null });
    } catch (error) {
      if (current()) setState({ loading: false, data: null, error: productFailure(error, 'We could not load products. Please try again.') });
    }
  }, [getRevision, loader]);
  useEffect(() => {
    reload();
    return () => reader.current?.abort();
  }, [reload]);
  return { ...state, reload };
}
