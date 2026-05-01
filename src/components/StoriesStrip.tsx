import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Story = {
  id: string;
  user_id: string;
  media_url: string | null;
  media_kind: "text" | "photo" | "video";
  content: string | null;
  created_at: string;
};

type Props = { profileUserId: string; isSelf: boolean; displayName?: string; avatarUrl?: string | null };

const STORY_DURATION_MS = 5000;

export const StoriesStrip = ({ profileUserId, isSelf, displayName, avatarUrl }: Props) => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  const load = async () => {
    const { data } = await supabase
      .from("posts")
      .select("id,user_id,media_url,media_kind,content,created_at")
      .eq("user_id", profileUserId)
      .eq("is_story", true)
      .order("created_at", { ascending: true });
    setStories((data ?? []) as Story[]);
  };

  useEffect(() => { load(); }, [profileUserId]);

  // Auto-advance progress (WhatsApp-style)
  useEffect(() => {
    if (viewing === null) return;
    const story = stories[viewing];
    if (!story) return;
    setProgress(0);
    startRef.current = performance.now();
    pausedRef.current = false;
    let pausedAt = 0;
    let pausedTotal = 0;

    const tick = (now: number) => {
      if (pausedRef.current) {
        if (!pausedAt) pausedAt = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      } else if (pausedAt) {
        pausedTotal += now - pausedAt;
        pausedAt = 0;
      }
      const elapsed = now - startRef.current - pausedTotal;
      const p = Math.min(1, elapsed / STORY_DURATION_MS);
      setProgress(p);
      if (p >= 1) {
        // advance
        setViewing((v) => {
          if (v === null) return null;
          if (v + 1 >= stories.length) return null;
          return v + 1;
        });
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [viewing, stories]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    if (f.size > 50 * 1024 * 1024) { toast.error("Max 50MB"); return; }
    setBusy(true);
    try {
      const isVideo = f.type.startsWith("video");
      const ext = f.name.split(".").pop();
      const path = `${user.id}/stories/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, f);
      if (upErr) throw upErr;
      const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        media_url: url,
        media_kind: isVideo ? "video" : "photo",
        is_story: true,
        audience: "all",
      });
      if (error) throw error;
      toast.success("Story added — disappears in 24h");
      load();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const hasStories = stories.length > 0;

  const goPrev = () => setViewing((v) => (v !== null && v > 0 ? v - 1 : v));
  const goNext = () => setViewing((v) => {
    if (v === null) return null;
    if (v + 1 >= stories.length) return null;
    return v + 1;
  });

  return (
    <>
      {/* Section header — gives Stories its own "tab" feel */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stories</h2>
        {hasStories && (
          <span className="text-[10px] text-muted-foreground">{stories.length} · last 24h</span>
        )}
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {isSelf && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="shrink-0 flex flex-col items-center gap-1 group"
            aria-label="Add story"
          >
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent p-[2px]">
              <div className="w-full h-full rounded-full bg-background grid place-items-center overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display font-bold text-primary text-xl">{displayName?.[0]?.toUpperCase() ?? "U"}</span>
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-primary text-primary-foreground grid place-items-center border-2 border-background">
                <Plus className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Your story</span>
          </button>
        )}

        {hasStories &&
          stories.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setViewing(i)}
              className="shrink-0 flex flex-col items-center gap-1"
              aria-label={`Open story ${i + 1}`}
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary via-accent to-primary p-[2px]">
                <div className="w-full h-full rounded-full overflow-hidden bg-background">
                  {s.media_url && s.media_kind === "photo" ? (
                    <img src={s.media_url} alt="" className="w-full h-full object-cover" />
                  ) : s.media_url && s.media_kind === "video" ? (
                    <video src={s.media_url} className="w-full h-full object-cover" muted />
                  ) : null}
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-foreground/80">#{i + 1}</span>
            </button>
          ))}

        {!hasStories && !isSelf && (
          <p className="text-xs text-muted-foreground py-4">No stories yet</p>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*,video/*" hidden onChange={onPick} />

      {/* WhatsApp-style fullscreen viewer */}
      {viewing !== null && stories[viewing] && (
        <div
          className="fixed inset-0 z-[80] bg-black grid place-items-center"
          onMouseDown={() => { pausedRef.current = true; }}
          onMouseUp={() => { pausedRef.current = false; }}
          onTouchStart={() => { pausedRef.current = true; }}
          onTouchEnd={() => { pausedRef.current = false; }}
        >
          {/* Header */}
          <div className="absolute top-0 inset-x-0 z-20 pt-[env(safe-area-inset-top)] px-3 pb-2 bg-gradient-to-b from-black/70 to-transparent">
            {/* Progress bars */}
            <div className="flex gap-1 mb-2">
              {stories.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full"
                    style={{
                      width:
                        i < viewing ? "100%" :
                        i === viewing ? `${progress * 100}%` :
                        "0%",
                      transition: i === viewing ? "none" : "width 0.2s linear",
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground text-xs font-bold">
                  {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : (displayName?.[0]?.toUpperCase() ?? "U")}
                </div>
                <div className="text-white">
                  <div className="text-sm font-semibold leading-tight">{displayName ?? "User"}</div>
                  <div className="text-[10px] text-white/70">{new Date(stories[viewing].created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
              <button
                onClick={() => setViewing(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Media */}
          <div className="absolute inset-0 flex items-center justify-center">
            {stories[viewing].media_kind === "video" ? (
              <video
                key={stories[viewing].id}
                src={stories[viewing].media_url ?? ""}
                className="w-full h-full object-contain"
                autoPlay
                playsInline
                onEnded={goNext}
              />
            ) : (
              <img
                src={stories[viewing].media_url ?? ""}
                alt=""
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Tap zones */}
          <button
            onClick={goPrev}
            className="absolute left-0 top-16 bottom-0 w-1/3 z-10 flex items-center justify-start pl-2 text-white/0 hover:text-white/40 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-0 top-16 bottom-0 w-1/3 z-10 flex items-center justify-end pr-2 text-white/0 hover:text-white/40 transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}
    </>
  );
};
