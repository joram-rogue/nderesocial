import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { TikTokEmbed } from "@/components/TikTokEmbed";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { extractTikTokVideoId } from "@/lib/tiktok";
import { Plus, Shuffle, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";

type Reel = { id: string; tiktok_url: string; video_id: string; author_handle: string | null };

export default function Reels() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [reels, setReels] = useState<Reel[]>([]);
  const [shuffle, setShuffle] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("tiktok_reels").select("id,tiktok_url,video_id,author_handle").order("created_at", { ascending: false });
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
    if (!user) return;
    const tokens = bulk.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) { toast.error("Paste at least one TikTok URL"); return; }

    setBusy(true);
    const rows: { tiktok_url: string; video_id: string; author_handle: string | null; added_by: string }[] = [];
    const skipped: string[] = [];
    for (const tok of tokens) {
      const parsed = extractTikTokVideoId(tok);
      if (!parsed) { skipped.push(tok); continue; }
      rows.push({
        tiktok_url: tok,
        video_id: parsed.id,
        author_handle: parsed.handle,
        added_by: user.id,
      });
    }

    if (rows.length === 0) {
      setBusy(false);
      toast.error("No valid TikTok video URLs found. Paste full video URLs (https://www.tiktok.com/@handle/video/...).");
      return;
    }

    const { error } = await supabase.from("tiktok_reels").insert(rows);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setBulk("");
    toast.success(`Added ${rows.length}${skipped.length ? ` · skipped ${skipped.length}` : ""}`);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this reel?")) return;
    await supabase.from("tiktok_reels").delete().eq("id", id);
    load();
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-xl font-bold">Reels</h1>
        <div className="flex gap-2">
          <button onClick={() => setShuffle((n) => n + 1)} className="glass rounded-xl p-2.5 hover:bg-primary/10" aria-label="Shuffle">
            <Shuffle className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button onClick={() => setShowAdmin((s) => !s)} className="glass rounded-xl p-2.5 hover:bg-primary/10" aria-label="Admin">
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isAdmin && showAdmin && (
        <div className="glass-strong rounded-3xl p-4 mb-4 space-y-3 animate-fade-in">
          <p className="text-sm text-muted-foreground">Paste TikTok video URLs — one per line or comma-separated. Each becomes an official embed.</p>
          <Textarea
            className="glass-input min-h-[120px] font-mono text-xs"
            placeholder={"https://www.tiktok.com/@ndereug/video/1234567890\nhttps://www.tiktok.com/@theafricandiary/video/9876543210"}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
          <div className="flex justify-end">
            <Button onClick={addMany} disabled={busy} className="bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl">
              {busy ? "Adding..." : "Add all"}
            </Button>
          </div>
          <div className="space-y-2 pt-2">
            {reels.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs glass rounded-xl px-3 py-2">
                <span className="truncate">@{r.author_handle ?? "unknown"} · {r.video_id}</span>
                <button onClick={() => remove(r.id)} className="text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {shuffled.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center text-muted-foreground text-sm">
          {isAdmin ? "No reels yet. Add one above." : <span className="flex items-center justify-center gap-2"><Lock className="w-4 h-4" /> Coming soon</span>}
        </div>
      ) : (
        <div className="space-y-4">
          {shuffled.map((r) => (
            <div key={r.id} className="glass-strong rounded-3xl p-2 overflow-hidden">
              <TikTokEmbed videoId={r.video_id} handle={r.author_handle} />
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
