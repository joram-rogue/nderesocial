import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { TikTokEmbed } from "@/components/TikTokEmbed";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { resolveTikTokUrl } from "@/lib/tiktok";
import { Plus, Shuffle, Trash2, Sparkles, Link2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Reel = {
  id: string;
  tiktok_url: string;
  video_id: string;
  author_handle: string | null;
  added_by: string;
};

export default function Reels() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [reels, setReels] = useState<Reel[]>([]);
  const [shuffle, setShuffle] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);

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

  const addMany = async () => {
    if (!user) { toast.error("Sign in to share reels"); return; }
    const tokens = bulk.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) { toast.error("Paste a TikTok link"); return; }

    setBusy(true);
    const rows: { tiktok_url: string; video_id: string; author_handle: string | null; added_by: string }[] = [];
    const skipped: string[] = [];

    // Resolve in parallel — short links hit the oEmbed endpoint
    const results = await Promise.all(tokens.map((t) => resolveTikTokUrl(t).then((p) => ({ t, p }))));
    for (const { t, p } of results) {
      if (!p) { skipped.push(t); continue; }
      rows.push({ tiktok_url: t, video_id: p.id, author_handle: p.handle, added_by: user.id });
    }

    if (rows.length === 0) {
      setBusy(false);
      toast.error("Couldn't read those links. Use the TikTok Share → Copy link button.");
      return;
    }

    const { error } = await supabase.from("tiktok_reels").insert(rows);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setBulk("");
    setComposerOpen(false);
    toast.success(`Added ${rows.length} reel${rows.length > 1 ? "s" : ""}${skipped.length ? ` · skipped ${skipped.length}` : ""}`);
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
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-xl font-bold">Reels</h1>
          <Sparkles className="w-4 h-4 text-accent animate-pulse" />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShuffle((n) => n + 1)}
            className="glass rounded-xl p-2.5 hover:bg-primary/10 transition-all hover:rotate-180 duration-500"
            aria-label="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setComposerOpen((s) => !s)}
            className="glass rounded-xl p-2.5 hover:bg-primary/10 transition-transform hover:scale-110"
            aria-label={composerOpen ? "Close" : "Add reel"}
          >
            {composerOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {composerOpen && (
        <div className="glass-strong rounded-3xl p-5 mb-4 space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="w-4 h-4 text-primary" />
            Share a TikTok
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            On TikTok, tap <span className="text-foreground font-medium">Share → Copy link</span>, then paste it here.
            Short links like <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">vm.tiktok.com/…</span> work perfectly. Drop multiple — one per line.
          </p>
          <Textarea
            className="glass-input min-h-[110px] font-mono text-xs"
            placeholder={"https://vm.tiktok.com/ZMabc123/\nhttps://www.tiktok.com/@ndereug/video/123…"}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setComposerOpen(false); setBulk(""); }} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={addMany}
              disabled={busy || !bulk.trim()}
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl shadow-[var(--shadow-warm)] gap-2"
            >
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Resolving…</> : <>Share <Sparkles className="w-3.5 h-3.5" /></>}
            </Button>
          </div>
        </div>
      )}

      {shuffled.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center text-muted-foreground text-sm animate-fade-in">
          <Sparkles className="w-6 h-6 mx-auto mb-2 text-accent animate-pulse" />
          No reels yet. Tap <Plus className="inline w-3.5 h-3.5 mx-1" /> to share the first one.
        </div>
      ) : (
        <div className="space-y-4">
          {shuffled.map((r, i) => (
            <div
              key={r.id}
              className="glass-strong rounded-3xl p-2 overflow-hidden animate-fade-in hover:shadow-[var(--shadow-warm)] transition-shadow"
              style={{ animationDelay: `${Math.min(i * 60, 400)}ms`, animationFillMode: "backwards" }}
            >
              <TikTokEmbed videoId={r.video_id} handle={r.author_handle} />
              <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
                <span className="truncate">@{r.author_handle ?? "tiktok"}</span>
                {canDelete(r) && (
                  <button
                    onClick={() => remove(r.id)}
                    className="text-destructive p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
