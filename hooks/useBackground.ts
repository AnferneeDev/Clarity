import { useState, useEffect } from "react";

type ViewType = "timer" | "stats" | "settings" | "todo" | "notes";

export default function useBackground() {
  const [backgrounds, setBackgrounds] = useState<Record<ViewType, string>>({
    timer: "",
    stats: "",
    settings: "",
    todo: "",
    notes: "",
  });

  useEffect(() => {
    const loadBackgrounds = async () => {
      try {
        const bgData = await window.electronAPI.getAllBackgrounds();
        console.log("Loaded background data:", bgData);

        const newBackgrounds: Record<ViewType, string> = {
          timer: "",
          stats: "",
          settings: "",
          todo: "",
          notes: "",
        };

        // Load background data for each view
        for (const view of Object.keys(newBackgrounds) as ViewType[]) {
          if (bgData[view]) {
            try {
              const bgImage = await window.electronAPI.getViewBackgroundData(view);
              if (bgImage) {
                newBackgrounds[view] = bgImage;
              }
            } catch (err) {
              console.error(`Failed to load background for ${view}:`, err);
              // If file doesn't exist, remove the database entry
              await window.electronAPI.removeViewBackground(view);
            }
          }
        }

        setBackgrounds(newBackgrounds);
      } catch (err) {
        console.error("Failed to load backgrounds:", err);
      }
    };
    loadBackgrounds();
  }, []);

  const handleBackgroundChange = async (view: ViewType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/jpg", "image/png", "image/gif", "image/bmp", "image/webp"].includes(file.type)) {
      alert("Invalid file type.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("File too large (>10MB).");
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      await window.electronAPI.setViewBackground(view, { name: file.name, data: uint8 });
      const bg = await window.electronAPI.getViewBackgroundData(view);
      if (bg) {
        setBackgrounds((prev) => ({ ...prev, [view]: bg }));
      }
    } catch (err) {
      console.error("Failed to set background:", err);
    }
    e.target.value = "";
  };

  const removeBackground = async (view: ViewType) => {
    try {
      await window.electronAPI.removeViewBackground(view);
      setBackgrounds((prev) => ({ ...prev, [view]: "" }));
    } catch (err) {
      console.error("Failed to remove background:", err);
    }
  };

  const getBackgroundForView = (currentView: ViewType): string => {
    // If current view has background, use it
    if (backgrounds[currentView]) {
      return backgrounds[currentView];
    }
    // Otherwise fall back to timer view background
    return backgrounds.timer || "";
  };

  return {
    backgrounds,
    handleBackgroundChange,
    removeBackground,
    getBackgroundForView,
  };
}
