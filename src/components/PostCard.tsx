import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Heart, MessageCircle, Download, Trash2, Send, Reply, Repeat2, Bookmark, Share2, Eye, Smile } from "lucide-react";
import { Watermark } from "./Watermark";
import { NativeVideo } from "./NativeVideo";
import { downloadFile, downloadImageWithWatermark, downloadText } from "@/lib/download";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { notify } from "@/hooks/useNotifications";

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

const QUICK_EMOJIS = ["❤️", "🔥", "😂", "😮", "😍", "👏", "🎉", "💯", "🥁", "🎶"];

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

// Renders text with @mentions as muted-primary spans (best-effort, by display_name).
const renderText = (text: string) => {
  const parts = text.split(/(@[A-Za-z0-9_.-]+)/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? <span key={i} className="text-primary font-medium">{p}</span> : <span key={i}>{p}</span>
  );
};

export const PostCard = ({ post, onChange }: { post: Post; onChange: () => void }) => {
  const { user } = useAuth();
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);

  const [reposts, setReposts] = useState(0);
  const [reposted, setReposted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [views, setViews] = useState(0);

  const viewedRef = useRef(false);

  const loadAll = async () => {
    const [{ count: lc }, likeMine, { count: rc }, repMine, bmMine, { count: vc }, cms] = await Promise.all([
      supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", post.id),
      user ? supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("reposts").select("*", { count: "exact", head: true }).eq("post_id", post.id),
      user ? supabase.from("reposts").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      user ? supabase.from("bookmarks").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("post_views").select("*", { count: "exact", head: true }).eq("post_id", post.id),
      supabase.from("comments").select("*").eq("post_id", post.id).order("created_at", { ascending: true }),
    ]);
    setLikes(lc ?? 0);
    setLiked(!!(likeMine as any)?.data);
    setReposts(rc ?? 0);
    setReposted(!!(repMine as any)?.data);
    setBookmarked(!!(bmMine as any)?.data);
    setViews(vc ?? 0);
    const cdata = (cms as any).data ?? [];
    if (cdata.length) {
      const ids = [...new Set(cdata.map((c: any) => c.user_id))];
      const { data: profs } = await supabase.from("profiles").select("id,display_name,avatar_url").in("id", ids as string[]);
      const m = new Map(profs?.map((p) => [p.id, p]));
      setComments(cdata.map((c: any) => ({ ...c, profile: m.get(c.user_id) })) as Comment[]);
    } else setComments([]);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [post.id, user?.id]);

  // Realtime: keep comments / likes / reposts in sync across users
  useEffect(() => {
    const ch = supabase
      .channel(`post:${post.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${post.id}` }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "likes", filter: `post_id=eq.${post.id}` }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "reposts", filter: `post_id=eq.${post.id}` }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [post.id]);

  // Mark a view once per session per user
  useEffect(() => {
    if (!user || viewedRef.current) return;
    viewedRef.current = true;
    supabase.from("post_views").insert({ post_id: post.id, user_id: user.id }).then(({ error }) => {
      if (!error) setViews((n) => n + 1);
    });
  }, [user?.id, post.id]);

  const toggleLike = async () => {
    if (!user) return;
    setLiked((v) => !v);
    setLikes((n) => (liked ? Math.max(0, n - 1) : n + 1));
    if (liked) {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      notify({ user_id: post.user_id, actor_id: user.id, type: "like", post_id: post.id }).catch(() => {});
    }
  };

  const toggleRepost = async () => {
    if (!user) return;
    setReposted((v) => !v);
    setReposts((n) => (reposted ? Math.max(0, n - 1) : n + 1));
    if (reposted) {
      await supabase.from("reposts").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      const { error } = await supabase.from("reposts").insert({ post_id: post.id, user_id: user.id });
      if (!error) toast.success("Reposted");
    }
  };

  const toggleBookmark = async () => {
    if (!user) return;
    setBookmarked((v) => !v);
    if (bookmarked) {
      await supabase.from("bookmarks").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      const { error } = await supabase.from("bookmarks").insert({ post_id: post.id, user_id: user.id });
      if (!error) toast.success("Saved");
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/u/${post.user_id}`;
    const data = { title: post.profile?.display_name || "Ndere", text: post.content?.slice(0, 80) || "", url };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch {/* cancelled */}
  };

  const addComment = async (text: string, parent_id: string | null = null) => {
    if (!user || !text.trim()) return;
    const { error } = await supabase.from("comments").insert({
      post_id: post.id, user_id: user.id, content: text.trim(), parent_id,
    });
    if (error) { toast.error(error.message); return; }
    notify({ user_id: post.user_id, actor_id: user.id, type: "comment", post_id: post.id }).catch(() => {});
    if (parent_id) { setReplyText(""); setReplyTo(null); } else { setNewComment(""); setEmojiOpen(false); }
    loadAll();
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

          {post.content && (
            <p className="text-[15px] leading-snug whitespace-pre-wrap break-words mb-2">{renderText(post.content)}</p>
          )}

          {post.media_url && (
            <div className="relative rounded-2xl overflow-hidden border border-border/40 mb-2">
              {post.media_kind === "video" ? (
                <div className="w-full max-h-[520px] aspect-[9/16] sm:aspect-video bg-black">
                  <NativeVideo src={post.media_url} autoPlayOnVisible={0.6} loop defaultMuted fit="contain" />
                </div>
              ) : (
                <img src={post.media_url} alt="" className="w-full max-h-[520px] object-contain bg-black" />
              )}
              <Watermark />
            </div>
          )}

          {/* Action bar — TikTok/X-style: comment, repost, bookmark, share, download + views */}
          <div className="flex items-center justify-between -ml-2 text-muted-foreground">
            <button className="group flex items-center gap-1 px-2 py-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
              <MessageCircle className="w-[18px] h-[18px]" />
              <span className="text-xs font-medium">{comments.length || ""}</span>
            </button>
            <button onClick={toggleRepost} className={`group flex items-center gap-1 px-2 py-1.5 rounded-full transition-colors ${reposted ? "text-emerald-500" : "hover:bg-emerald-500/10 hover:text-emerald-500"}`}>
              <Repeat2 className="w-[18px] h-[18px]" />
              <span className="text-xs font-medium">{reposts || ""}</span>
            </button>
            <button onClick={toggleBookmark} className={`group flex items-center gap-1 px-2 py-1.5 rounded-full transition-colors ${bookmarked ? "text-accent" : "hover:bg-accent/10 hover:text-accent"}`}>
              <Bookmark className={`w-[18px] h-[18px] ${bookmarked ? "fill-current" : ""}`} />
            </button>
            <button onClick={share} className="group flex items-center gap-1 px-2 py-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
              <Share2 className="w-[18px] h-[18px]" />
            </button>
            <button onClick={handleDownload} className="group flex items-center gap-1 px-2 py-1.5 rounded-full hover:bg-accent/10 hover:text-accent transition-colors">
              <Download className="w-[18px] h-[18px]" />
            </button>
            <div className="flex items-center gap-1 px-2 py-1.5 text-muted-foreground/80">
              <Eye className="w-[16px] h-[16px]" />
              <span className="text-xs font-medium">{views}</span>
            </div>
          </div>

          {/* Like row separately to keep the heart prominent */}
          <div className="-ml-2 -mt-1 mb-1">
            <button onClick={toggleLike} className={`group inline-flex items-center gap-1 px-2 py-1.5 rounded-full transition-colors ${liked ? "text-destructive" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"}`}>
              <Heart className={`w-[18px] h-[18px] ${liked ? "fill-current" : ""}`} />
              <span className="text-xs font-medium">{likes || ""}</span>
            </button>
          </div>

          {/* Comments — always visible */}
          <div className="mt-2 pt-3 border-t border-border/30 space-y-3">
            <div className="flex gap-2 items-center">
              <button onClick={() => setEmojiOpen((s) => !s)} className={`p-2 rounded-full ${emojiOpen ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5"}`} aria-label="Emoji">
                <Smile className="w-4 h-4" />
              </button>
              <input value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComment(newComment)}
                placeholder="Write a comment… use @name to mention" maxLength={300}
                className="flex-1 glass-input rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40" />
              <button onClick={() => addComment(newComment)} className="p-2 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary"><Send className="w-4 h-4" /></button>
            </div>
            {emojiOpen && (
              <div className="flex gap-1 flex-wrap">
                {QUICK_EMOJIS.map((e) => (
                  <button key={e} onClick={() => setNewComment((d) => d + e)} className="text-xl px-2 py-1 rounded-lg hover:bg-white/10 active:scale-90 transition-transform">
                    {e}
                  </button>
                ))}
              </div>
            )}

            {topComments.length === 0 && (
              <p className="text-xs text-muted-foreground py-1">Be the first to comment ✨</p>
            )}

            {topComments.map((c) => (
              <div key={c.id} className="space-y-2">
                <div className="flex gap-2.5">
                  <Avatar url={c.profile?.avatar_url} name={c.profile?.display_name} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-semibold mr-1.5">{c.profile?.display_name ?? "User"}</span>
                      <span className="break-words">{renderText(c.content)}</span>
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
                      <span className="break-words">{renderText(r.content)}</span>
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
        </div>
      </div>
    </article>
  );
};
