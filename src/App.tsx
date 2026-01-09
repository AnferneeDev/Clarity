import { useState, useEffect } from "react";
import { TooltipProvider } from "../components/ui/tooltip";
import { SidebarProvider } from "../components/ui/sidebar";
import SidebarNav from "../components/SidebarNav";
import TimerView from "../components/views/TimerView";
import StatsView from "../components/views/StatsView";
import SettingsView from "../components/views/SettingsView";
import TodoView from "../components/views/TodoView";
import NotesView from "../components/views/NotesView";
import LoginView from "../components/views/LoginView";
import ChaptersView from "../components/views/ChaptersView";
import MotivationView from "../components/views/MotivationView";
import GameView from "../components/views/GameView";
import useBackground from "../hooks/useBackground";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"timer" | "stats" | "settings" | "todo" | "notes" | "chapters" | "motivation" | "game">("timer");
  const { backgrounds, handleBackgroundChange, removeBackground, getBackgroundForView } = useBackground();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 1. Check with Backend first (Source of Truth for session)
        const session = await window.electronAPI.auth.getSession();
        
        if (session) {
          console.log("[App] Session restored from backend:", session);
          localStorage.setItem("clarity_user_id", session.id);
          localStorage.setItem("clarity_username", session.username);
          setCurrentUser(session);
          setIsAuthenticated(true);
        } else {
          // 2. If Backend has no user, check localStorage and try to restore
          const storedId = localStorage.getItem("clarity_user_id");
          const storedUsername = localStorage.getItem("clarity_username");
          
          if (storedId && storedUsername) {
            console.log("[App] Restoring session from localStorage...");
            // Attempt auto-login to restore backend state
            const user = await window.electronAPI.auth.login(storedUsername);
            if (user) {
              console.log("[App] Auto-login successful");
              setCurrentUser(user);
              setIsAuthenticated(true);
            } else {
              console.warn("[App] Stored credentials invalid or user not found. Clearing.");
              localStorage.removeItem("clarity_user_id");
              localStorage.removeItem("clarity_username");
              setIsAuthenticated(false);
            }
          }
        }
      } catch (err) {
        console.error("[App] Auth check failed:", err);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    await window.electronAPI.auth.logout();
    localStorage.removeItem("clarity_user_id");
    localStorage.removeItem("clarity_username");
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const handleLoginSuccess = (user: { id: string; username: string }) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const currentBackground = getBackgroundForView(activeTab);
  const timerIsActive = activeTab === "timer";
  const todoIsActive = activeTab === "todo";
  const overlayActive = timerIsActive || todoIsActive;

  if (isLoading) {
    return <div className="h-screen w-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="h-screen w-screen flex bg-black" style={currentBackground ? { backgroundImage: `url(${currentBackground})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}>
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
                  {!overlayActive && activeTab === "chapters" && <ChaptersView />}
                  {!overlayActive && activeTab === "motivation" && <MotivationView />}
                  {!overlayActive && activeTab === "game" && <GameView />}
                  {!overlayActive && activeTab === "notes" && <NotesView />}
                  {!overlayActive && activeTab === "settings" && (
                    <SettingsView 
                      backgrounds={backgrounds} 
                      onBackgroundChange={handleBackgroundChange} 
                      onRemoveBackground={removeBackground}
                      username={currentUser?.username}
                      onLogout={handleLogout}
                    />
                  )}
                </div>
              </div>
            </section>
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
