import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Copy, X } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "autofix.usage";
const DAILY_LIMIT = 2;

type Usage = { date: string; count: number };

const today = () => new Date().toISOString().slice(0, 10);

const getUsage = (): Usage => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: today(), count: 0 };
    const u = JSON.parse(raw) as Usage;
    if (u.date !== today()) return { date: today(), count: 0 };
    return u;
  } catch {
    return { date: today(), count: 0 };
  }
};

const bumpUsage = () => {
  const u = getUsage();
  const next = { date: today(), count: u.count + 1 };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const AutoFixOverlay = () => {
  const [errorText, setErrorText] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage>(() => getUsage());

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      const msg = `${e.message}\n\nSource: ${e.filename}:${e.lineno}:${e.colno}\n\n${e.error?.stack || ""}`.trim();
      setErrorText(msg);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r: any = e.reason;
      const msg = `Unhandled promise rejection: ${r?.message || String(r)}\n\n${r?.stack || ""}`.trim();
      setErrorText(msg);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  const dismiss = useCallback(() => setErrorText(null), []);

  const copyAndPrompt = useCallback(async () => {
    if (!errorText) return;
    const u = getUsage();
    if (u.count >= DAILY_LIMIT) {
      toast.error(`Auto-fix limit reached (${DAILY_LIMIT}/day). Try again tomorrow.`);
      return;
    }
    const payload = `Please fix this error in my app:\n\n${errorText}`;
    try {
      await navigator.clipboard.writeText(payload);
      const next = bumpUsage();
      setUsage(next);
      toast.success(`Error copied. Paste it into chat to fix. (${next.count}/${DAILY_LIMIT} today)`);
      dismiss();
    } catch {
      toast.error("Couldn't copy. Long-press the error text to copy manually.");
    }
  }, [errorText, dismiss]);

  if (!errorText) return null;
  const remaining = Math.max(0, DAILY_LIMIT - usage.count);

  return (
    <div className="fixed inset-x-3 bottom-3 z-[200] glass-strong rounded-2xl p-4 border border-destructive/40 shadow-2xl animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-destructive/15 text-destructive shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Something broke</p>
            <button onClick={dismiss} className="p-1 rounded-lg hover:bg-white/5" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
          <pre className="mt-1.5 text-[11px] text-muted-foreground max-h-24 overflow-auto whitespace-pre-wrap break-words">
            {errorText}
          </pre>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {remaining}/{DAILY_LIMIT} auto-fix left today
            </span>
            <button
              onClick={copyAndPrompt}
              disabled={remaining === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-primary to-accent text-primary-foreground disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy & fix
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
