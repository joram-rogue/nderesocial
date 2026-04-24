import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Heart, MessageCircle, Download, Trash2, Send, Reply } from "lucide-react";
import { Watermark } from "./Watermark";
import { downloadFile, downloadImageWithWatermark, downloadText } from "@/lib/download";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export type Post = {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_kind: "text" | "photo" | "video";
  audience: "all" | "staff" | "troupe";
  created_at: string;
  profile?: { display_name: string; avatar_url: string | null };
};

type Comment = {
  id: string; user_id: string; content: string; parent_id: string | null; created_at: string;
  profile?: { display_name: string; avatar_url: string | null };
};

const Avatar = ({ url, name, size = 40 }: { url?: string | null; name?: string | null; size?: number }) => (
  <div
    className="rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-display font-bold"
    style={{ width: size, height: size, fontSize: size * 0.42 }}
  >
    {url ? (
      <img src={url} alt="" className="w-full h-full object-cover" />
    ) : (
      <span>{name?.[0]?.toUpperCase() ?? "U"}</span>
    )}
  </div>
);

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

export const PostCard = ({ post, onChange }: { post: Post; onChange: () => void }) => {
  const { user } = useAuth();
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const loadCounts = async () => {
    const { count } = await supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", post.id);
    setLikes(count ?? 0);
    if (user) {
      const { data } = await supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle();
      setLiked(!!data);
    }
  };

  const loadComments = async () => {
    const { data } = await supabase.from("comments").select("*").eq("post_id", post.id).order("created_at", { ascending: true });
    if (!data) return;
    const ids = [...new Set(data.map((c) => c.user_id))];
    const { data: profs } = await supabase.from("profiles").select("id,display_name,avatar_url").in("id", ids);
    const m = new Map(profs?.map((p) => [p.id, p]));
    setComments(data.map((c) => ({ ...c, profile: m.get(c.user_id) as any })) as Comment[]);
  };

  useEffect(() => { loadCounts(); }, [post.id, user?.id]);
  useEffect(() => { if (showComments) loadComments(); }, [showComments]);

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
    }
    loadCounts();
  };

  const addComment = async (text: string, parent_id: string | null = null) => {
    if (!user || !text.trim()) return;
    const { error } = await supabase.from("comments").insert({
      post_id: post.id, user_id: user.id, content: text.trim(), parent_id,
    });
    if (error) { toast.error(error.message); return; }
    if (parent_id) { setReplyText(""); setReplyTo(null); } else { setNewComment(""); }
    loadComments();
  };

  const handleDownload = async () => {
    try {
      if (post.media_kind === "photo" && post.media_url) {
        await downloadImageWithWatermark(post.media_url, `ndere-${post.id}.png`);
      } else if (post.media_kind === "video" && post.media_url) {
        downloadFile(post.media_url, `ndere-${post.id}.mp4`);
      } else if (post.content) {
        downloadText(post.content, post.profile?.display_name || "user", `ndere-${post.id}.txt`);
      }
      toast.success("Downloaded");
    } catch { toast.error("Download failed"); }
  };

  const remove = async () => {
    if (!confirm("Delete this post?")) return;
    await supabase.from("posts").delete().eq("id", post.id);
    onChange();
  };

  const topComments = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  return (
    <article className="px-4 py-3 border-b border-border/40 hover:bg-white/[0.015] transition-colors animate-fade-in">
      <div className="flex gap-3">
        <Link to={`/u/${post.user_id}`} className="shrink-0">
          <Avatar url={post.profile?.avatar_url} name={post.profile?.display_name} size={40} />
        </Link>

        <div className="flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 mb-0.5">
            <Link to={`/u/${post.user_id}`} className="flex items-center gap-1.5 min-w-0 group">
              <span className="font-semibold text-[15px] truncate group-hover:underline">{post.profile?.display_name ?? "User"}</span>
              <span className="text-muted-foreground text-sm shrink-0">· {timeAgo(post.created_at)}</span>
              {post.audience !== "all" && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
                  {post.audience}
                </span>
              )}
            </Link>
            {user?.id === post.user_id && (
              <button onClick={remove} className="p-1.5 -mr-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </header>

          {post.content && <p className="text-[15px] leading-snug whitespace-pre-wrap break-words mb-2">{post.content}</p>}

          {post.media_url && (
            <div className="relative rounded-2xl overflow-hidden border border-border/40 mb-2">
              {post.media_kind === "video" ? (
                <video src={post.media_url} controls className="w-full max-h-[520px] object-contain bg-black" />
              ) : (
                <img src={post.media_url} alt="" className="w-full max-h-[520px] object-contain bg-black" />
              )}
              <Watermark />
            </div>
          )}

          <div className="flex items-center justify-between max-w-[360px] -ml-2 text-muted-foreground">
            <button onClick={() => setShowComments((s) => !s)} className="group flex items-center gap-1 px-2 py-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
              <MessageCircle className="w-[18px] h-[18px]" />
              <span className="text-xs font-medium">{comments.length || ""}</span>
            </button>
            <button onClick={toggleLike} className={`group flex items-center gap-1 px-2 py-1.5 rounded-full hover:bg-destructive/10 transition-colors ${liked ? "text-destructive" : "hover:text-destructive"}`}>
              <Heart className={`w-[18px] h-[18px] ${liked ? "fill-current" : ""}`} />
              <span className="text-xs font-medium">{likes || ""}</span>
            </button>
            <button onClick={handleDownload} className="group flex items-center gap-1 px-2 py-1.5 rounded-full hover:bg-accent/10 hover:text-accent transition-colors">
              <Download className="w-[18px] h-[18px]" />
            </button>
          </div>

          {showComments && (
            <div className="mt-3 pt-3 border-t border-border/30 space-y-3">
              <div className="flex gap-2">
                <input value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComment(newComment)}
                  placeholder="Write a comment…" maxLength={300}
                  className="flex-1 glass-input rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                <button onClick={() => addComment(newComment)} className="p-2 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary"><Send className="w-4 h-4" /></button>
              </div>

              {topComments.map((c) => (
                <div key={c.id} className="space-y-2">
                  <div className="flex gap-2.5">
                    <Avatar url={c.profile?.avatar_url} name={c.profile?.display_name} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <span className="font-semibold mr-1.5">{c.profile?.display_name ?? "User"}</span>
                        <span className="break-words">{c.content}</span>
                      </div>
                      <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="text-[11px] text-muted-foreground hover:text-primary mt-0.5 inline-flex items-center gap-1">
                        <Reply className="w-3 h-3" /> Reply
                      </button>
                    </div>
                  </div>

                  {repliesOf(c.id).map((r) => (
                    <div key={r.id} className="flex gap-2 pl-9">
                      <Avatar url={r.profile?.avatar_url} name={r.profile?.display_name} size={24} />
                      <div className="text-sm flex-1 min-w-0">
                        <span className="font-semibold mr-1.5">{r.profile?.display_name ?? "User"}</span>
                        <span className="break-words">{r.content}</span>
                      </div>
                    </div>
                  ))}

                  {replyTo === c.id && (
                    <div className="flex gap-2 pl-9">
                      <input value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComment(replyText, c.id)}
                        placeholder="Write a reply…" autoFocus maxLength={300}
                        className="flex-1 glass-input rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
                      <button onClick={() => addComment(replyText, c.id)} className="p-1.5 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary"><Send className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
