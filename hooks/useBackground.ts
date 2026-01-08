import { useState, useEffect } from "react";

type ViewType = "timer" | "stats" | "settings" | "todo" | "notes";

export default function useBackground() {
  const [backgrounds, setBackgrounds] = useState<Record<ViewType, string>>({} as any);

  // Load backgrounds on mount
  useEffect(() => {
    loadBackgrounds();
  }, []);

  const loadBackgrounds = async () => {
    try {
      const bgs = await window.electronAPI.getAllBackgrounds();
      setBackgrounds(bgs);
    } catch (err) {
      console.error("Failed to load backgrounds", err);
    }
  };

  const handleBackgroundChange = async (view: ViewType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/bmp", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Invalid file type. Please use JPG, PNG, GIF, BMP, or WebP.");
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      alert("File too large (>10MB).");
      return;
    }

    try {
      // FileReader to get buffer for IPC
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        if (arrayBuffer) {
          const uint8Array = new Uint8Array(arrayBuffer);
          const name = file.name;
          
          await window.electronAPI.setViewBackground(view, { name, data: uint8Array });
          
          // Reload to get updated paths
          loadBackgrounds();
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Failed to set background:", err);
    }
    
    e.target.value = "";
  };

  const removeBackground = async (view: ViewType) => {
    try {
      await window.electronAPI.removeViewBackground(view);
      setBackgrounds(prev => {
        const next = { ...prev };
        delete next[view];
        return next;
      });
    } catch (err) {
      console.error("Failed to remove background", err);
    }
  };

  const getBackgroundForView = (currentView: ViewType): string => {
    // If current view has background, use it
    if (backgrounds[currentView]) {
      // If it starts with 'http' or 'data:', return as is. 
      // If it's a relative path (from storage), we need the full URL?
      // Actually main process returns relative path. 
      // We need a way to serve it. 
      // `preload.ts` has `getViewBackgroundData` which returns data URI. 
      // But we are storing relative paths here.
      // Let's use `getViewBackgroundData` for everything? 
      // Or relies on `asset://` protocol if we had one.
      // Easiest is to fetch data URI.
      // BUT `getAllBackgrounds` returns paths. 
      // We probably should have `getAllBackgrounds` return Data URIs or handles fetching.
      
      // Temporary fix: `backgrounds` state should hold Data URIs or we fetch them one by one.
      // Or we can just use `getViewBackgroundData` inside the component? 
      // `useBackground` is a hook.
      // Let's assume we fetch them.
      return backgrounds[currentView]; 
    }
    // Fallback to timer background
    return backgrounds.timer || "";
  };
  
  // We need to actually fetch data URIs for the background images because they are local files
  // and renderer cannot read them directly due to security, unless we use `file://` (only in dev) or custom protocol.
  // My `main.ts` `getViewBackgroundData` returns a Data URI.
  // `getAllBackgrounds` returns paths.
  // I should probably update `loadBackgrounds` to fetch data for each?
  // Or update `getAllBackgrounds` in main.ts to return data? 
  // Returning all data might be heavy.
  // Better: components call `getViewBackgroundData`?
  // But `Layout.tsx` uses this hook to set background.
  
  // Let's fetch data URIs in `loadBackgrounds`.
  // Wait, `loadBackgrounds` gets keys.
  // For each key, call `getViewBackgroundData`.
  
  useEffect(() => {
    const fetchImages = async () => {
        const bgs = await window.electronAPI.getAllBackgrounds();
        const loaded: Record<string, string> = {};
        for (const view of Object.keys(bgs)) {
            const dataUrl = await window.electronAPI.getViewBackgroundData(view);
            if (dataUrl) loaded[view] = dataUrl;
        }
        setBackgrounds(initial => ({...initial, ...loaded}));
    };
    fetchImages();
  }, []);

  return {
    backgrounds,
    handleBackgroundChange,
    removeBackground,
    getBackgroundForView,
  };
}
