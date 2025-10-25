// src/renderer/App.tsx
import { useState } from "react";
import { TooltipProvider } from "../components/ui/tooltip";
import { SidebarProvider } from "../components/ui/sidebar";
import SidebarNav from "../components/SidebarNav";
import TimerView from "../components/views/TimerView";
import StatsView from "../components/views/StatsView";
import SettingsView from "../components/views/SettingsView";
import TodoView from "../components/views/TodoView";
import NotesView from "../components/views/NotesView";
import useBackground from "../hooks/useBackground";

export default function App() {
  const [activeTab, setActiveTab] = useState<"timer" | "stats" | "settings" | "todo" | "notes">("timer");
  const { backgrounds, handleBackgroundChange, removeBackground, getBackgroundForView } = useBackground();

  const currentBackground = getBackgroundForView(activeTab);
  const timerIsActive = activeTab === "timer";
  const todoIsActive = activeTab === "todo";
  const overlayActive = timerIsActive || todoIsActive; // other foreground should be blocked when either timer or todo is active

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="h-screen w-screen flex bg-pink-700" style={currentBackground ? { backgroundImage: `url(${currentBackground})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}>
          <SidebarNav activeTab={activeTab} setActiveTab={setActiveTab} />

          <main className="flex-1 flex flex-col min-h-0">
            <section className="flex-1 p-4 min-h-0 overflow-hidden">
              <div
                className="h-full w-full"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gridTemplateRows: "1fr",
                }}
              >
                {/* TimerView wrapper (always mounted). Make it invisible when not active. */}
                <div
                  style={{
                    gridArea: "1/1",
                    position: "relative",
                    zIndex: 1,
                    pointerEvents: timerIsActive ? "auto" : "none",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    overflow: "hidden",
                    opacity: timerIsActive ? 1 : 0,
                    visibility: timerIsActive ? "visible" : "hidden",
                    transition: "opacity 200ms ease, visibility 200ms",
                  }}
                  aria-hidden={!timerIsActive}
                >
                  <TimerView />
                </div>

                {/* TodoView wrapper (always mounted). Make it invisible when not active. */}
                <div
                  style={{
                    gridArea: "1/1",
                    position: "relative",
                    zIndex: 1,
                    pointerEvents: todoIsActive ? "auto" : "none",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    overflow: "hidden",
                    opacity: todoIsActive ? 1 : 0,
                    visibility: todoIsActive ? "visible" : "hidden",
                    transition: "opacity 200ms ease, visibility 200ms",
                  }}
                  aria-hidden={!todoIsActive}
                >
                  <TodoView />
                </div>

                {/* Foreground wrapper for other views: scrolls and is interactive */}
                <div
                  style={{
                    gridArea: "1/1",
                    position: "relative",
                    zIndex: 2,
                    pointerEvents: overlayActive ? "none" : "auto",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    overflow: "auto",
                  }}
                  aria-hidden={overlayActive}
                >
                  {!overlayActive && activeTab === "stats" && <StatsView />}
                  {!overlayActive && activeTab === "settings" && <SettingsView backgrounds={backgrounds} onBackgroundChange={handleBackgroundChange} onRemoveBackground={removeBackground} />}
                  {!overlayActive && activeTab === "todo" && <TodoView />}
                  {!overlayActive && activeTab === "notes" && <NotesView />}
                </div>
              </div>
            </section>
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
