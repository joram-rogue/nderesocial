import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Account from "./pages/Account";
import Reels from "./pages/Reels";
import Chat from "./pages/Chat";
import Compose from "./pages/Compose";
import Live from "./pages/Live";
import NotFound from "./pages/NotFound";
import { AutoFixOverlay } from "./components/AutoFixOverlay";
import { InstallPrompt } from "./components/InstallPrompt";
import { NotificationsBoot } from "./components/NotificationsBoot";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner theme="dark" position="top-center" />
      <AutoFixOverlay />
      <InstallPrompt />
      <BrowserRouter>
        <AuthProvider>
          <NotificationsBoot />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reels" element={<Reels />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/compose" element={<Compose />} />
            <Route path="/live" element={<Live />} />
            <Route path="/live/:id" element={<Live />} />
            <Route path="/account" element={<Account />} />
            <Route path="/u/:id" element={<Account />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
