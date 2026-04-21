import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { PostComposer } from "@/components/PostComposer";
import { PostCard, type Post } from "@/components/PostCard";
import { fetchPostsWithProfiles } from "@/lib/posts";

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => { if (!loading && !user) navigate("/auth", { replace: true }); }, [user, loading, navigate]);

  const load = async () => { setBusy(true); setPosts(await fetchPostsWithProfiles()); setBusy(false); };
  useEffect(() => { if (user) load(); }, [user]);

  if (loading || !user) return (
    <div className="min-h-screen grid place-items-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <Layout>
      <div className="space-y-4">
        <PostComposer onPosted={load} />
        {busy && posts.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Loading…</div>
        ) : posts.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center text-muted-foreground">No posts yet. Be the first.</div>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} onChange={load} />)
        )}
      </div>
    </Layout>
  );
}
