import { useState, useEffect, useCallback } from 'react';
import { getBackground, setBackground, removeBackground, getAllBackgrounds } from '@/lib/db';

export function useBackground(viewName: string) {
  const [background, setBackground_] = useState<string | null>(null);
  const [allBackgrounds, setAllBackgrounds] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const map = await getAllBackgrounds();
      setAllBackgrounds(map);
      setBackground_(map[viewName] || null);
    } catch {} finally { setLoaded(true); }
  }, [viewName]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const setViewBackground = useCallback(async (view: string, dataUri: string) => {
    await setBackground(view, dataUri);
    await loadAll();
  }, [loadAll]);

  const removeViewBackground = useCallback(async (view: string) => {
    await removeBackground(view);
    await loadAll();
  }, [loadAll]);

  return { background, allBackgrounds, loaded, setViewBackground, removeViewBackground, refresh: loadAll };
}
