import { Clock, BarChart3, Settings, ListTodo, StickyNote } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import logo from "../assets/icon.ico";

interface SidebarNavProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
}

export default function SidebarNav({ activeTab, setActiveTab }: SidebarNavProps) {
  // ✅ Settings included in navItems with `bottom: true`
  const navItems = [
    { key: "timer", label: "Timer", icon: Clock },
    { key: "stats", label: "Stats", icon: BarChart3 },
    { key: "todo", label: "Tasks", icon: ListTodo },
    { key: "notes", label: "Notes", icon: StickyNote },
    { key: "settings", label: "Settings", icon: Settings, bottom: true },
  ];

  return (
    <aside className="flex flex-col h-screen w-12 bg-[#0a0810]">
      {/* Header with logo */}
      <div className="flex items-center justify-center px-0 py-3">
        <img src={logo} alt="Logo" className="w-6 h-6 rounded" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-0.5 py-3 space-y-1 flex flex-col">
        {navItems.map(({ key, label, icon: Icon, bottom }) => {
          const active = activeTab === key;
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button onClick={() => setActiveTab(key)} className={`flex items-center justify-center w-full px-3 py-2 rounded-lg text-sm transition text-white ${active ? "bg-[#2a1636]" : "hover:bg-[#2a1636]/50"} ${bottom ? "mt-auto" : ""}`}>
                  <Icon className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </aside>
  );
}
