import { useState, useEffect, useCallback } from 'react';

const LS_BG = 'clarity_bg_';

export function useBackground(viewName: string) {
  const [background, setBackground] = useState<string | null>(null);
  const [allBackgrounds, setAllBackgrounds] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const result: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LS_BG)) {
          result[key.replace(LS_BG, '')] = localStorage.getItem(key) || '';
        }
      }
      setAllBackgrounds(result);
    } catch { } finally { setLoaded(true); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (loaded) setBackground(allBackgrounds[viewName] || null);
  }, [viewName, allBackgrounds, loaded]);

  const setViewBackground = useCallback(async (file: File) => {
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      localStorage.setItem(LS_BG + viewName, dataUrl);
      setBackground(dataUrl);
      await loadAll();
    } catch { }
  }, [viewName, loadAll]);

  const removeBackground = useCallback(async () => {
    localStorage.removeItem(LS_BG + viewName);
    setBackground(null);
    setAllBackgrounds(prev => { const n = { ...prev }; delete n[viewName]; return n; });
  }, [viewName]);

  return { background, allBackgrounds, loaded, setViewBackground, removeBackground, fetchAllBackgrounds: loadAll };
}
