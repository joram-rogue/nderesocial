import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { NativeVideo } from "@/components/NativeVideo";
import { ReelActions } from "@/components/ReelActions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CameraCapture } from "@/components/CameraCapture";
import { LogoLoader } from "@/components/LogoLoader";
import { MediaEditor, EditorResult } from "@/components/MediaEditor";
import {
  Shuffle, Trash2, Sparkles, X, Loader2,
  Home, Film, MessageCircle, User, LogOut, Video, Radio,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/ndere-logo.png";


type FeedItem =
  { kind: "user"; id: string; video_url: string; caption: string | null; user_id: string; filter_css: string | null; expires_at: string | null };


const expiryLabel = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 1) return `Expires in ${h}h ${m}m`;
  return `Expires in ${m}m`;
};

export default function Reels() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "admin";

  const [items, setItems] = useState<FeedItem[]>([]);

  const [shuffle, setShuffle] = useState(0);
  const [busy, setBusy] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [editing, setEditing] = useState<{ file: File; url: string } | null>(null);
  const [pendingCaption, setPendingCaption] = useState<{ file: File; caption: string; filterCss: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);

  const load = async () => {
    const nowIso = new Date().toISOString();
    const { data } = await supabase.from("user_reels")
      .select("id,video_url,caption,user_id,filter_css,expires_at")
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("created_at", { ascending: false });
    setItems((data ?? []).map((r) => ({ kind: "user" as const, ...r })));
  };
  useEffect(() => { load(); }, []);

  const shuffled = useMemo(() => {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, shuffle]);

  // Track which slide is in view; pause off-screen videos
  useEffect(() => {
    if (!containerRef.current || shuffled.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const el = e.target as HTMLElement;
          const idx = Number(el.dataset.idx);
          const vid = el.querySelector("video[data-user-reel]") as HTMLVideoElement | null;
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            if (!Number.isNaN(idx)) setActiveIdx(idx);
            vid?.play().catch(() => {});
          } else {
            vid?.pause();
          }
        });
      },
      { root: containerRef.current, threshold: [0.6] }
    );
    slideRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [shuffled]);

  // Everyone: record → edit → caption → post
  const onCapture = (file: File) => {
    setCameraOpen(false);
    setEditing({ file, url: URL.createObjectURL(file) });
  };

  const onEditDone = (r: EditorResult) => {
    if (editing) URL.revokeObjectURL(editing.url);
    setEditing(null);
    setPendingCaption({ file: r.file, caption: "", filterCss: r.filterCss });
  };

  const publishRecording = async () => {
    if (!user || !pendingCaption) return;
    setBusy(true);
    try {
      const ext = pendingCaption.file.name.split(".").pop() || "webm";
      const path = `${user.id}/reel-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, pendingCaption.file, {
        contentType: pendingCaption.file.type,
      });
      if (upErr) throw upErr;
      const video_url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      const isVideo = pendingCaption.file.type.startsWith("video");
      const { error } = await supabase.from("user_reels").insert({
        user_id: user.id,
        video_url,
        caption: pendingCaption.caption.trim() || null,
        filter_css: isVideo && pendingCaption.filterCss !== "none" ? pendingCaption.filterCss : null,
      });
      if (error) throw error;
      toast.success("Posted to Reels");
      setPendingCaption(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to post");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (item: FeedItem) => {
    if (!confirm("Remove this reel?")) return;
    const { error } = await supabase.from("user_reels").delete().eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const canDelete = (item: FeedItem) => {
    if (isAdmin) return true;
    return item.user_id === user?.id;
  };


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
              onClick={() => navigate("/live")}
              className="p-2 rounded-full bg-destructive/20 backdrop-blur-md hover:bg-destructive/30 text-destructive"
              aria-label="Go live"
            >
              <Radio className="w-4 h-4" />
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

      {/* Floating Record FAB — everyone */}
      {user && !cameraOpen && !pendingCaption && (
        <button
          onClick={() => setCameraOpen(true)}
          className="fixed right-4 bottom-20 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground grid place-items-center shadow-[var(--shadow-warm)] hover:scale-110 transition-transform"
          aria-label="Record reel"
        >
          <Video className="w-6 h-6" />
        </button>
      )}

      {/* Link composer overlay — open to all */}
      {composerOpen && (
        <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setComposerOpen(false)}>
          <div className="w-full sm:max-w-md bg-card text-foreground rounded-t-3xl sm:rounded-3xl p-5 space-y-3 animate-fade-in border border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Link2 className="w-4 h-4 text-primary" /> Add a video link
            </div>
            <p className="text-xs text-muted-foreground">TikTok, YouTube, Instagram, Vimeo, mp4 — one per line.</p>
            <Textarea className="glass-input min-h-[110px] font-mono text-xs" placeholder="https://…" value={bulk} onChange={(e) => setBulk(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setComposerOpen(false); setBulk(""); }} className="rounded-xl">Cancel</Button>
              <Button onClick={addMany} disabled={busy || !bulk.trim()} className="bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl gap-2">
                {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Camera overlay */}
      {cameraOpen && <CameraCapture onCapture={onCapture} onClose={() => setCameraOpen(false)} />}

      {/* Editor */}
      {editing && (
        <MediaEditor
          source={editing}
          onCancel={() => { URL.revokeObjectURL(editing.url); setEditing(null); }}
          onDone={onEditDone}
        />
      )}

      {/* Caption sheet after recording */}
      {pendingCaption && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setPendingCaption(null)} className="p-2 rounded-full bg-white/10"><X className="w-5 h-5" /></button>
            <span className="text-sm font-semibold">New reel</span>
            <Button onClick={publishRecording} disabled={busy} className="bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-full px-5 gap-2">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Posting…</> : "Post"}
            </Button>
          </div>
          <div className="flex-1 relative overflow-hidden">
            {pendingCaption.file.type.startsWith("video") ? (
              <video src={URL.createObjectURL(pendingCaption.file)} className="absolute inset-0 w-full h-full object-contain" style={{ filter: pendingCaption.filterCss }} controls autoPlay loop />
            ) : (
              <img src={URL.createObjectURL(pendingCaption.file)} alt="" className="absolute inset-0 w-full h-full object-contain" />
            )}
          </div>
          <div className="p-4 bg-black">
            <Textarea
              value={pendingCaption.caption}
              onChange={(e) => setPendingCaption({ ...pendingCaption, caption: e.target.value })}
              placeholder="Add a caption (optional)…"
              maxLength={280}
              className="glass-input min-h-[60px] text-sm"
            />
          </div>
        </div>
      )}

      {/* Vertical snap feed */}
      {shuffled.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center px-8 gap-4">
          <LogoLoader size={48} />
          <div className="text-center text-white/70 text-sm">
            No reels yet. Tap the <Video className="inline w-3.5 h-3.5 mx-1" /> button to record one.
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar">
          {shuffled.map((item, i) => {
            const visible = Math.abs(i - activeIdx) <= 1;
            return (
              <section
                key={`${item.kind}-${item.id}`}
                data-idx={i}
                ref={(el) => { slideRefs.current[i] = el; }}
                className="h-[100dvh] w-full snap-start snap-always relative flex items-center justify-center"
              >
                {visible ? (
                  <div className="relative w-full max-w-[460px] h-full flex items-center justify-center px-2 animate-fade-in">
                    {item.kind === "user" ? (
                      <div className="w-full h-full" style={{ filter: item.filter_css ?? undefined }}>
                        <NativeVideo
                          src={item.video_url}
                          autoPlayOnVisible={0.6}
                          loop
                          defaultMuted
                          fit="contain"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full">
                        <ExternalReel platform={item.platform} embed_url={item.embed_url} video_id={item.video_id} handle={item.author_handle} />
                      </div>
                    )}

                    {/* Right action rail */}
                    <div className="absolute right-3 bottom-28 flex flex-col items-center gap-4 z-10">
                      <ReelActions
                        reelId={item.id}
                        reelKind={item.kind}
                        shareUrl={item.kind === "external" ? item.tiktok_url : `${window.location.origin}/reels`}
                        shareTitle={item.kind === "user" ? item.caption ?? "Ndere Reel" : `@${item.author_handle ?? item.platform}`}
                      />
                      {item.kind === "external" && (
                        <a
                          href={item.tiktok_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20"
                          aria-label="Open original"
                        >
                          <Film className="w-5 h-5" />
                        </a>
                      )}
                      {canDelete(item) && (
                        <button
                          onClick={() => remove(item)}
                          className="p-3 rounded-full bg-white/10 backdrop-blur-md hover:bg-destructive/30"
                          aria-label="Remove"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    {/* Bottom caption */}
                    <div className="absolute left-4 right-20 bottom-28 z-10 pointer-events-none">
                      <div className="text-sm font-semibold drop-shadow-lg">
                        {item.kind === "external"
                          ? `@${item.author_handle ?? item.platform}`
                          : "Ndere FAM"}
                      </div>
                      {item.kind === "user" && item.caption && (
                        <div className="text-[12px] text-white/85 drop-shadow line-clamp-2 mt-0.5">{item.caption}</div>
                      )}
                      {item.expires_at && (
                        <div className="mt-1.5 inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/20 text-accent backdrop-blur-md pointer-events-auto">
                          {expiryLabel(item.expires_at)}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center"><LogoLoader size={48} /></div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Bottom nav (docked) */}
      {user && (
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-black/85 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-2xl mx-auto grid grid-cols-4 h-16">
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
                  `flex items-center justify-center transition-colors ${isActive ? "text-primary" : "text-white/70 hover:text-white"}`
                }
              >
                <Icon className="w-6 h-6" />
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
