import { setSetting, getSetting } from "./crud";

export function setViewBackground(view: string, filePath: string): void {
  setSetting(`background_${view}`, filePath);
}

export function getViewBackground(view: string): string | null {
  return getSetting(`background_${view}`);
}

export function removeViewBackground(view: string): void {
  setSetting(`background_${view}`, "");
}

export function getAllBackgrounds(): Record<string, string> {
  const views = ["timer", "stats", "settings", "todo", "notes"];
  const backgrounds: Record<string, string> = {};

  views.forEach((view) => {
    const background = getViewBackground(view);
    if (background) {
      backgrounds[view] = background;
    }
  });

  return backgrounds;
}

// Keep the old single background functions for compatibility if needed
export function setBackground(filePath: string): void {
  setSetting("background", filePath);
}

export function getBackground(): string | null {
  return getSetting("background");
}
