import { Settings, Trash2, Wallpaper, Clock, BarChart3, ListTodo, StickyNote, User, LogOut, LayoutGrid } from "lucide-react";
import { Button } from "../ui/button";

type ViewType = "timer" | "stats" | "settings" | "todo" | "notes" | "chapters";

interface SettingsViewProps {
  backgrounds: Record<ViewType, string>;
  onBackgroundChange: (view: ViewType, e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveBackground: (view: ViewType) => void;
  username?: string;
  onLogout?: () => void;
}

export default function SettingsView({ backgrounds, onBackgroundChange, onRemoveBackground, username, onLogout }: SettingsViewProps) {
  const sections: { key: ViewType; label: string; icon: React.ComponentType<any> }[] = [
    { key: "timer", label: "Timer", icon: Clock },
    { key: "stats", label: "Stats", icon: BarChart3 },
    { key: "todo", label: "Tasks", icon: ListTodo },
    { key: "chapters", label: "Chapters", icon: LayoutGrid },
    { key: "notes", label: "Notes", icon: StickyNote },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 overflow-auto">
      {/* === Title === */}
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 md:w-7 md:h-7 text-white" />
        <h2 className="text-2xl md:text-3xl font-bold text-white">Settings</h2>
      </div>

      {/* === Account Section === */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Account</h3>
        <div className="glass-card p-4 rounded-xl border border-gray-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
               <User className="w-5 h-5 text-blue-400" />
             </div>
             <div>
               <div className="text-sm text-gray-400">Signed in as</div>
               <div className="text-white font-medium">{username || "User"}</div>
             </div>
          </div>
          
          <Button onClick={onLogout} variant="destructive" size="sm" className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* === Background Section === */}
      <h3 className="text-lg font-semibold text-white mb-3">Custom Backgrounds</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section) => {
          const IconComponent = section.icon;
          return (
            <div key={section.key} className="glass-card p-4 rounded-xl border border-gray-700/50">
              {/* Subsection title with icon */}
              <div className="flex items-center gap-2 mb-3">
                <IconComponent className="w-4 h-4 text-white/80" />
                <h4 className="text-sm font-medium text-white/90">{section.label} background</h4>
              </div>

              {/* Background preview */}
              {backgrounds[section.key] ? (
                <img src={backgrounds[section.key]} alt={`${section.label} background`} className="w-full h-24 object-cover rounded-lg border border-gray-600/50 mb-3" />
              ) : (
                <div className="w-full h-24 flex items-center justify-center rounded-lg border border-dashed bg-gray-300/40 border-gray-600/50 text-white/50 text-sm mb-3">No background set</div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                {/* Change button */}
                <div className="relative flex-1">
                  <input type="file" accept="image/*" onChange={(e) => onBackgroundChange(section.key, e)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <Button size="sm" className="w-full text-white bg-gray-400/70 hover:bg-white/20 border border-gray-600 px-3 py-2 text-xs">
                    <Wallpaper className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                    Change
                  </Button>
                </div>

                {/* Delete button - only show if there's a background to delete */}
                {backgrounds[section.key] && (
                  <Button size="sm" variant="destructive" onClick={() => onRemoveBackground(section.key)} className="flex items-center gap-1 px-3 py-2 text-xs cursor-pointer">
                    <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
