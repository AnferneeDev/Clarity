import { useState, useEffect } from "react";

type ViewType = "timer" | "stats" | "settings" | "todo" | "notes" | "chapters";

export default function useBackground() {
  const [backgrounds, setBackgrounds] = useState<Record<ViewType, string>>({} as any);

  // Load backgrounds on mount
  // Load backgrounds on mount
  useEffect(() => {
    loadBackgrounds();
  }, []);

  const loadBackgrounds = async () => {
    try {
      const bgs = await window.electronAPI.getAllBackgrounds();
      
      // Fetch data URIs for each background
      const loaded: Record<string, string> = {};
      for (const [view, path] of Object.entries(bgs)) {
         if (path) {
            const dataUrl = await window.electronAPI.getViewBackgroundData(view);
            if (dataUrl) loaded[view] = dataUrl;
         }
      }
      
      setBackgrounds(loaded as any);
    } catch (err) {
      console.error("Failed to load backgrounds", err);
    }
  };

  const handleBackgroundChange = async (view: ViewType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File too large (>10MB).");
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        if (arrayBuffer) {
          const uint8Array = new Uint8Array(arrayBuffer);
          const name = file.name;
          
          await window.electronAPI.setViewBackground(view, { name, data: uint8Array });
          // Reload to get updated data URI
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
    if (backgrounds[currentView]) {
      return backgrounds[currentView]; 
    }
    return backgrounds.timer || ""; // Fallback
  };

  return {
    backgrounds,
    handleBackgroundChange,
    removeBackground,
    getBackgroundForView,
  };
}
