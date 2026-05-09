import { TooltipProvider } from '@/components/ui/tooltip';
import SidebarNav from '../components/sidebar/SidebarNav';

interface AppLayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
  backgroundUrl: string | null;
}

export default function AppLayout({ activeTab, setActiveTab, children, backgroundUrl }: AppLayoutProps) {
  return (
    <TooltipProvider>
      <div className="h-screen w-screen flex bg-black">
        <SidebarNav activeTab={activeTab} setActiveTab={setActiveTab} />
        <main
          className="flex-1 flex flex-col min-h-0"
          style={
            backgroundUrl
              ? { backgroundImage: `url(${backgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : {}
          }
        >
          <section className="flex-1 p-4 min-h-0 overflow-hidden">
            {children}
          </section>
        </main>
      </div>
    </TooltipProvider>
  );
}
