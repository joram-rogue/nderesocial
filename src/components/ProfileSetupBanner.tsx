import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, X } from "lucide-react";

const DISMISS_KEY = "ndere.setup.dismissed";

/**
 * Nudges users whose profile is incomplete (no avatar or bio) to finish setup.
 * Renders inline above the feed. Persists dismissal in localStorage.
 */
export const ProfileSetupBanner = () => {
  const { user } = useAuth();
  const [incomplete, setIncomplete] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => !!localStorage.getItem(DISMISS_KEY));

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, bio, display_name")
        .eq("id", user.id)
        .maybeSingle();
      const missing = !data?.avatar_url || !data?.bio || !data?.display_name;
      setIncomplete(missing);
    })();
  }, [user?.id]);

  if (!user || !incomplete || dismissed) return null;

  return (
    <div className="mb-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-accent/10 p-3 flex items-center gap-3 animate-fade-in">
      <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary grid place-items-center shrink-0">
        <Sparkles className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Finish setting up your profile</p>
        <p className="text-[11px] text-muted-foreground">Add an avatar and short bio so friends recognize you.</p>
      </div>
      <Link
        to="/account"
        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground"
      >
        Set up
      </Link>
      <button
        onClick={() => { localStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); }}
        className="p-1 rounded-full hover:bg-white/10 text-muted-foreground"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
