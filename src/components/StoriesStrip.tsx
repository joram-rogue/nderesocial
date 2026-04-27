import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, X } from "lucide-react";
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

export const StoriesStrip = ({ profileUserId, isSelf, displayName, avatarUrl }: Props) => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("posts")
      .select("id,user_id,media_url,media_kind,content,created_at")
      .eq("user_id", profileUserId)
      .eq("is_story", true)
      .order("created_at", { ascending: false });
    setStories((data ?? []) as Story[]);
  };

  useEffect(() => { load(); }, [profileUserId]);

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

  return (
    <>
      <div className="flex items-center gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
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

        {hasStories && (
          <button
            onClick={() => setViewing(0)}
            className="shrink-0 flex flex-col items-center gap-1"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary via-accent to-primary p-[2px]">
              <div className="w-full h-full rounded-full overflow-hidden bg-background">
                {stories[0].media_url && stories[0].media_kind === "photo" ? (
                  <img src={stories[0].media_url} alt="" className="w-full h-full object-cover" />
                ) : stories[0].media_url && stories[0].media_kind === "video" ? (
                  <video src={stories[0].media_url} className="w-full h-full object-cover" muted />
                ) : null}
              </div>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-foreground/80">{stories.length} story</span>
          </button>
        )}

        {!hasStories && !isSelf && (
          <p className="text-xs text-muted-foreground py-4">No stories yet</p>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*,video/*" hidden onChange={onPick} />

      {viewing !== null && stories[viewing] && (
        <div
          className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-sm grid place-items-center animate-fade-in"
          onClick={() => setViewing(null)}
        >
          <button
            onClick={() => setViewing(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-full max-w-md aspect-[9/16] relative" onClick={(e) => e.stopPropagation()}>
            {stories[viewing].media_kind === "video" ? (
              <video src={stories[viewing].media_url ?? ""} className="w-full h-full object-contain" autoPlay controls />
            ) : (
              <img src={stories[viewing].media_url ?? ""} alt="" className="w-full h-full object-contain" />
            )}
            <div className="absolute top-0 inset-x-0 flex gap-1 p-2">
              {stories.map((_, i) => (
                <div key={i} className={`flex-1 h-0.5 rounded-full ${i <= viewing ? "bg-white" : "bg-white/30"}`} />
              ))}
            </div>
            {stories.length > 1 && (
              <>
                <button
                  onClick={() => setViewing((v) => (v! > 0 ? v! - 1 : v))}
                  className="absolute left-0 inset-y-0 w-1/3"
                  aria-label="Previous"
                />
                <button
                  onClick={() => setViewing((v) => (v! < stories.length - 1 ? v! + 1 : null))}
                  className="absolute right-0 inset-y-0 w-1/3"
                  aria-label="Next"
                />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
