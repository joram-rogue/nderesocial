import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TikTokEmbed } from "@/components/TikTokEmbed";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { resolveTikTokUrl } from "@/lib/tiktok";
import {
  Plus, Shuffle, Trash2, Sparkles, Link2, X, Loader2,
  Home, Film, MessageCircle, User, LogOut,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/ndere-logo.png";

type Reel = {
  id: string;
  tiktok_url: string;
  video_id: string;
  author_handle: string | null;
  added_by: string;
};

export default function Reels() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "admin";
  const [reels, setReels] = useState<Reel[]>([]);
  const [shuffle, setShuffle] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("tiktok_reels")
      .select("id,tiktok_url,video_id,author_handle,added_by")
      .order("created_at", { ascending: false });
    setReels(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const shuffled = useMemo(() => {
    const arr = [...reels];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reels, shuffle]);

  // Track which slide is in view
  useEffect(() => {
    if (!containerRef.current || shuffled.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.idx);
            if (!Number.isNaN(idx)) setActiveIdx(idx);
          }
        });
      },
      { root: containerRef.current, threshold: [0.6] }
    );
    slideRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [shuffled]);

  const addMany = async () => {
    if (!user) { toast.error("Sign in to share reels"); return; }
    const tokens = bulk.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) { toast.error("Paste a TikTok link"); return; }

    setBusy(true);
    const rows: { tiktok_url: string; video_id: string; author_handle: string | null; added_by: string }[] = [];
    const skipped: string[] = [];
    const results = await Promise.all(tokens.map((t) => resolveTikTokUrl(t).then((p) => ({ t, p }))));
    for (const { t, p } of results) {
      if (!p) { skipped.push(t); continue; }
      rows.push({ tiktok_url: t, video_id: p.id, author_handle: p.handle, added_by: user.id });
    }
    if (rows.length === 0) {
      setBusy(false);
      toast.error("Couldn't read those links. Use TikTok's Share → Copy link.");
      return;
    }
    const { error } = await supabase.from("tiktok_reels").insert(rows);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setBulk("");
    setComposerOpen(false);
    toast.success(`Added ${rows.length}${skipped.length ? ` · skipped ${skipped.length}` : ""}`);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this reel?")) return;
    const { error } = await supabase.from("tiktok_reels").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const canDelete = (r: Reel) => isAdmin || r.added_by === user?.id;

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      {/* Top bar */}
      <header className="absolute top-0 inset-x-0 z-30 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14 bg-gradient-to-b from-black/70 to-transparent">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="" className="w-7 h-7" />
            <span className="font-display font-bold text-base">Reels</span>
            <Sparkles className="w-3.5 h-3.5 text-accent animate-pulse" />
          </Link>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShuffle((n) => n + 1)}
              className="p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all hover:rotate-180 duration-500"
              aria-label="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button
              onClick={() => setComposerOpen((s) => !s)}
              className="p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-transform hover:scale-110"
              aria-label="Add"
            >
              {composerOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
            {user && (
              <button
                onClick={async () => { await signOut(); navigate("/auth"); }}
                className="p-2 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Composer overlay */}
      {composerOpen && (
        <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setComposerOpen(false)}>
          <div
            className="w-full sm:max-w-md bg-card text-foreground rounded-t-3xl sm:rounded-3xl p-5 space-y-3 animate-fade-in border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Link2 className="w-4 h-4 text-primary" />
              Share a TikTok
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tap <span className="text-foreground font-medium">Share → Copy link</span> on TikTok, then paste here. Short links work too.
            </p>
            <Textarea
              className="glass-input min-h-[110px] font-mono text-xs"
              placeholder={"https://vm.tiktok.com/ZMabc123/"}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setComposerOpen(false); setBulk(""); }} className="rounded-xl">Cancel</Button>
              <Button
                onClick={addMany}
                disabled={busy || !bulk.trim()}
                className="bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl gap-2"
              >
                {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Resolving…</> : <>Share <Sparkles className="w-3.5 h-3.5" /></>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Vertical snap feed */}
      {shuffled.length === 0 ? (
        <div className="h-full flex items-center justify-center px-8">
          <div className="text-center text-white/70 text-sm animate-fade-in">
            <Sparkles className="w-7 h-7 mx-auto mb-3 text-accent animate-pulse" />
            No reels yet. Tap <Plus className="inline w-3.5 h-3.5 mx-1" /> to share the first one.
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
        >
          {shuffled.map((r, i) => {
            const visible = Math.abs(i - activeIdx) <= 1; // virtualize
            return (
              <section
                key={r.id}
                data-idx={i}
                ref={(el) => { slideRefs.current[i] = el; }}
                className="h-[100dvh] w-full snap-start snap-always relative flex items-center justify-center"
              >
                {visible ? (
                  <div className="relative w-full max-w-[420px] h-full flex items-center justify-center px-2 animate-fade-in">
                    <div className="w-full">
                      <TikTokEmbed videoId={r.video_id} handle={r.author_handle} />
                    </div>

                    {/* Right action rail */}
                    <div className="absolute right-3 bottom-28 flex flex-col items-center gap-4 z-10">
                      <a
                        href={r.tiktok_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-transform hover:scale-110"
                        aria-label="Open on TikTok"
                      >
                        <Film className="w-5 h-5" />
                      </a>
                      {canDelete(r) && (
                        <button
                          onClick={() => remove(r.id)}
                          className="p-3 rounded-full bg-white/10 backdrop-blur-md hover:bg-destructive/30 transition-transform hover:scale-110"
                          aria-label="Remove"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    {/* Bottom caption */}
                    <div className="absolute left-4 right-20 bottom-28 z-10 pointer-events-none">
                      <div className="text-sm font-semibold drop-shadow-lg">
                        @{r.author_handle ?? "tiktok"}
                      </div>
                      <div className="text-[11px] text-white/70 drop-shadow">Shared on Ndere FAM</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-white/30 text-xs">Loading…</div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Bottom nav */}
      {user && (
        <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-black/50 backdrop-blur-xl border border-white/10 rounded-full px-2 py-2 flex gap-1 shadow-2xl">
          {[
            { to: "/", icon: Home, end: true },
            { to: "/reels", icon: Film },
            { to: "/chat", icon: MessageCircle },
            { to: "/account", icon: User },
          ].map(({ to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `p-3 rounded-full transition-all ${isActive ? "bg-primary text-primary-foreground" : "text-white/70 hover:text-white"}`
              }
            >
              <Icon className="w-5 h-5" />
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
