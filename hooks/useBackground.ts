import { useState, useEffect } from "react";
import dataService from "../src/services/dataService";

type ViewType = "timer" | "stats" | "settings" | "todo" | "notes";

export default function useBackground() {
  const [backgrounds, setBackgrounds] = useState<Record<ViewType, string>>(() => dataService.getBackgrounds());

  // Load backgrounds on mount
  useEffect(() => {
    setBackgrounds(dataService.getBackgrounds());
  }, []);

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
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          dataService.setBackground(view, dataUrl);
          setBackgrounds(prev => ({ ...prev, [view]: dataUrl }));
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Failed to set background:", err);
    }
    
    e.target.value = "";
  };

  const removeBackground = (view: ViewType) => {
    dataService.removeBackground(view);
    setBackgrounds(prev => ({ ...prev, [view]: "" }));
  };

  const getBackgroundForView = (currentView: ViewType): string => {
    // If current view has background, use it
    if (backgrounds[currentView]) {
      return backgrounds[currentView];
    }
    // Fallback to timer background
    return backgrounds.timer || "";
  };

  return {
    backgrounds,
    handleBackgroundChange,
    removeBackground,
    getBackgroundForView,
  };
}
