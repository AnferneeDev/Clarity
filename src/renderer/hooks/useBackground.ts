import { useState, useEffect, useCallback } from 'react';

export function useBackground(viewName: string) {
  const [background, setBackground] = useState<string | null>(null);
  const [allBackgrounds, setAllBackgrounds] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  // Load ALL backgrounds on mount (altver pattern)
  useEffect(() => {
    loadAll();
  }, []);

  // Listen for background changes from other components (e.g. SettingsView)
  useEffect(() => {
    return window.electronAPI.settings.onBackgroundChanged(() => {
      loadAll();
    });
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const bgs = await window.electronAPI.settings.getAllBackgrounds();
      setAllBackgrounds(bgs);
    } catch (err) {
      console.error('[Background] Load failed:', err);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Load ALL backgrounds on mount (altver pattern)
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Listen for background changes from other components (e.g. SettingsView)
  useEffect(() => {
    return window.electronAPI.settings.onBackgroundChanged(() => {
      loadAll();
    });
  }, [loadAll]);

  // When allBackgrounds changes, derive current view's background
  useEffect(() => {
    if (loaded) {
      setBackground(allBackgrounds[viewName] || null);
    }
  }, [viewName, allBackgrounds, loaded]);

  const fetchAllBackgrounds = useCallback(async () => {
    try {
      const bgs = await window.electronAPI.settings.getAllBackgrounds();
      setAllBackgrounds(bgs);
    } catch (err) {
      console.error('[Background] Fetch all failed:', err);
    }
  }, []);

  const setViewBackground = useCallback(async (file: { name: string; data: Uint8Array }) => {
    try {
      const url = await window.electronAPI.settings.setBackground(viewName, file);
      if (url) {
        setBackground(url);
        // Refresh the full map so Settings UI updates instantly
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
      setAllBackgrounds(prev => {
        const next = { ...prev };
        delete next[viewName];
        return next;
      });
    } catch (err) {
      console.error('[Background] Remove failed:', err);
    }
  }, [viewName]);

  return { background, allBackgrounds, loaded, setViewBackground, removeBackground, fetchAllBackgrounds };
}
