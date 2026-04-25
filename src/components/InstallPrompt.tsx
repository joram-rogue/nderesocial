import { useEffect, useState } from "react";
import { toast } from "sonner";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const PROMPTED_KEY = "ndere.installPrompted";

export const InstallPrompt = () => {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Already installed?
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    if (standalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      // Auto-fire prompt once if browser allows it
      if (!sessionStorage.getItem(PROMPTED_KEY)) {
        sessionStorage.setItem(PROMPTED_KEY, "1");
        // Slight delay so user sees the app first
        setTimeout(() => {
          (e as BIPEvent).prompt().catch(() => {});
        }, 800);
      }
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    window.addEventListener("appinstalled", () => {
      toast.success("Ndere FAM installed!");
      setEvt(null);
    });
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  if (!evt || hidden) return null;

  const install = async () => {
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === "accepted") setEvt(null);
    } catch {/* ignore */}
  };

  return (
    <div className="fixed inset-x-3 top-3 z-[150] glass-strong rounded-2xl p-3 flex items-center gap-3 animate-fade-in">
      <img src="/icon-192.png" alt="" width={40} height={40} className="w-10 h-10 rounded-xl" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">Install Ndere FAM</p>
        <p className="text-[11px] text-muted-foreground">Add to your home screen for full-screen access.</p>
      </div>
      <button onClick={install} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-primary to-accent text-primary-foreground">
        Install
      </button>
      <button onClick={() => setHidden(true)} className="text-muted-foreground text-xs px-2">✕</button>
    </div>
  );
};
