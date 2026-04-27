import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Heart, MessageCircle, Share2, X, Send, Smile } from "lucide-react";
import { toast } from "sonner";

const QUICK_EMOJIS = ["❤️", "🔥", "😂", "😮", "😍", "👏", "🎉", "💯", "🥁", "🎶"];

type Comment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { display_name: string; avatar_url: string | null } | null;
};

type Props = {
  reelId: string;
  reelKind: "user" | "external";
  shareUrl: string;
  shareTitle?: string;
};

export const ReelActions = ({ reelId, reelKind, shareUrl, shareTitle }: Props) => {
  const { user } = useAuth();
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);

  const loadCounts = async () => {
    const { count } = await supabase
      .from("reel_likes")
      .select("*", { count: "exact", head: true })
      .eq("reel_id", reelId);
    setLikes(count ?? 0);
    if (user) {
      const { data } = await supabase
        .from("reel_likes")
        .select("id")
        .eq("reel_id", reelId)
        .eq("user_id", user.id)
        .maybeSingle();
      setLiked(!!data);
    }
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from("reel_comments")
      .select("id,user_id,content,created_at")
      .eq("reel_id", reelId)
      .order("created_at", { ascending: true });
    if (!data) return;
    const ids = [...new Set(data.map((c) => c.user_id))];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,display_name,avatar_url")
      .in("id", ids);
    const m = new Map(profs?.map((p) => [p.id, p]));
    setComments(data.map((c) => ({ ...c, profile: m.get(c.user_id) as any })) as Comment[]);
  };

  useEffect(() => { loadCounts(); }, [reelId, user?.id]);
  useEffect(() => { if (commentsOpen) loadComments(); }, [commentsOpen]);

  const toggleLike = async () => {
    if (!user) { toast.error("Sign in to like"); return; }
    if (busy) return;
    setBusy(true);
    // Optimistic
    setLiked((v) => !v);
    setLikes((n) => (liked ? Math.max(0, n - 1) : n + 1));
    if (liked) {
      await supabase.from("reel_likes").delete().eq("reel_id", reelId).eq("user_id", user.id);
    } else {
      await supabase.from("reel_likes").insert({
        reel_id: reelId, reel_kind: reelKind, user_id: user.id,
      });
    }
    setBusy(false);
  };

  const send = async (text: string) => {
    if (!user || !text.trim()) return;
    const { error } = await supabase.from("reel_comments").insert({
      reel_id: reelId, reel_kind: reelKind, user_id: user.id, content: text.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setDraft("");
    loadComments();
  };

  const share = async () => {
    const data = { title: shareTitle || "Ndere Reel", url: shareUrl };
    try {
      if (navigator.share) {
        await navigator.share(data);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied");
      }
    } catch {/* user cancelled */}
  };

  return (
    <>
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={toggleLike}
          className="flex flex-col items-center gap-0.5"
          aria-label="Like"
        >
          <div className={`p-3 rounded-full backdrop-blur-md transition-all ${liked ? "bg-destructive/30 scale-110" : "bg-white/10 hover:bg-white/20"}`}>
            <Heart className={`w-5 h-5 ${liked ? "fill-destructive text-destructive" : ""}`} />
          </div>
          <span className="text-[11px] font-semibold drop-shadow">{likes || ""}</span>
        </button>

        <button
          onClick={() => setCommentsOpen(true)}
          className="flex flex-col items-center gap-0.5"
          aria-label="Comments"
        >
          <div className="p-3 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20">
            <MessageCircle className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-semibold drop-shadow">{comments.length || ""}</span>
        </button>

        <button
          onClick={share}
          className="flex flex-col items-center gap-0.5"
          aria-label="Share"
        >
          <div className="p-3 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20">
            <Share2 className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-semibold drop-shadow">Share</span>
        </button>
      </div>

      {commentsOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end animate-fade-in"
          onClick={() => setCommentsOpen(false)}
        >
          <div
            className="w-full bg-card text-foreground rounded-t-3xl max-h-[75dvh] flex flex-col border-t border-white/10 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <h3 className="font-display font-bold">{comments.length} {comments.length === 1 ? "comment" : "comments"}</h3>
              <button onClick={() => setCommentsOpen(false)} className="p-1.5 rounded-full hover:bg-white/10" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {comments.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Be the first to comment ✨</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground text-xs font-bold">
                      {c.profile?.avatar_url ? (
                        <img src={c.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (c.profile?.display_name?.[0]?.toUpperCase() ?? "U")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <span className="font-semibold mr-1.5">{c.profile?.display_name ?? "User"}</span>
                        <span className="break-words">{c.content}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {emojiOpen && (
              <div className="px-3 py-2 border-t border-border/40 flex gap-1 flex-wrap">
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setDraft((d) => d + e)}
                    className="text-2xl px-2 py-1 rounded-lg hover:bg-white/10 active:scale-90 transition-transform"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            <div className="px-3 py-3 border-t border-border/40 pb-[calc(env(safe-area-inset-bottom)+12px)] flex items-center gap-2">
              <button
                onClick={() => setEmojiOpen((s) => !s)}
                className={`p-2 rounded-full ${emojiOpen ? "bg-primary/20 text-primary" : "hover:bg-white/10"}`}
                aria-label="Emoji"
              >
                <Smile className="w-5 h-5" />
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(draft)}
                placeholder={user ? "Add a comment…" : "Sign in to comment"}
                disabled={!user}
                maxLength={300}
                className="flex-1 glass-input rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
              />
              <button
                onClick={() => send(draft)}
                disabled={!user || !draft.trim()}
                className="p-2 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
