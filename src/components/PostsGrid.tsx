import { useState } from "react";
import { Film, Image as ImageIcon, FileText, X } from "lucide-react";
import { PostCard, type Post } from "./PostCard";

type Props = { posts: Post[]; onChange: () => void };

export const PostsGrid = ({ posts, onChange }: Props) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = posts.find((p) => p.id === openId);

  if (posts.length === 0) {
    return (
      <div className="glass rounded-3xl p-10 text-center text-muted-foreground">
        No posts yet.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {posts.map((p) => (
          <button
            key={p.id}
            onClick={() => setOpenId(p.id)}
            className="relative aspect-square overflow-hidden bg-muted/30 group"
            aria-label="Open post"
          >
            {p.media_kind === "photo" && p.media_url ? (
              <img src={p.media_url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
            ) : p.media_kind === "video" && p.media_url ? (
              <>
                <video src={p.media_url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                <Film className="absolute top-1.5 right-1.5 w-4 h-4 text-white drop-shadow" />
              </>
            ) : (
              <div className="w-full h-full grid place-items-center p-2 bg-gradient-to-br from-primary/10 to-accent/10">
                <p className="text-[11px] leading-tight text-foreground/80 line-clamp-6 text-center">
                  {p.content?.slice(0, 140) || ""}
                </p>
                <FileText className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-muted-foreground" />
              </div>
            )}
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-md overflow-y-auto animate-fade-in"
          onClick={() => setOpenId(null)}
        >
          <div className="min-h-full flex items-start justify-center p-4 pt-16">
            <div
              className="w-full max-w-xl glass-strong rounded-3xl overflow-hidden relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setOpenId(null)}
                className="absolute top-3 right-3 z-10 p-2 rounded-full bg-background/70 backdrop-blur hover:bg-background"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <PostCard post={open} onChange={() => { onChange(); setOpenId(null); }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
