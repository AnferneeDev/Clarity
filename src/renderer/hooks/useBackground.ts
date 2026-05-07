import { useState, useEffect, useCallback } from 'react';

export function useBackground(viewName: string) {
  const [background, setBackground] = useState<string | null>(null);
  const [allBackgrounds, setAllBackgrounds] = useState<Record<string, string>>({});

  const fetchBackground = useCallback(async () => {
    try {
      const url = await window.electronAPI.settings.getBackground(viewName);
      setBackground(url);
    } catch (err) {
      console.error('[Background] Fetch failed:', err);
    }
  }, [viewName]);

  const fetchAllBackgrounds = useCallback(async () => {
    try {
      const bgs = await window.electronAPI.settings.getAllBackgrounds();
      setAllBackgrounds(bgs);
    } catch (err) {
      console.error('[Background] Fetch all failed:', err);
    }
  }, []);

  useEffect(() => {
    fetchBackground();
  }, [fetchBackground]);

  const setViewBackground = useCallback(async (file: { name: string; data: Uint8Array }) => {
    try {
      const url = await window.electronAPI.settings.setBackground(viewName, file);
      if (url) {
        setBackground(url);
        await fetchAllBackgrounds();
        return url;
      }
      return null;
    } catch (err) {
      console.error('[Background] Set failed:', err);
      return null;
    }
  }, [viewName, fetchAllBackgrounds]);

  const removeBackground = useCallback(async () => {
    try {
      await window.electronAPI.settings.removeBackground(viewName);
      setBackground(null);
      await fetchAllBackgrounds();
    } catch (err) {
      console.error('[Background] Remove failed:', err);
    }
  }, [viewName, fetchAllBackgrounds]);

  return { background, allBackgrounds, setViewBackground, removeBackground, fetchAllBackgrounds };
}
