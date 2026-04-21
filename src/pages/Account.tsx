import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { PostCard, type Post } from "@/components/PostCard";
import { fetchPostsWithProfiles } from "@/lib/posts";

export default function Account() {
  const { id } = useParams();
  const { user } = useAuth();
  const targetId = id || user?.id;
  const [profile, setProfile] = useState<{ display_name: string; bio: string | null } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [role, setRole] = useState<string | null>(null);

  const load = async () => {
    if (!targetId) return;
    const { data: p } = await supabase.from("profiles").select("display_name,bio").eq("id", targetId).maybeSingle();
    setProfile(p);
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", targetId).maybeSingle();
    setRole(r?.role ?? null);
    setPosts(await fetchPostsWithProfiles({ user_id: targetId }));
  };
  useEffect(() => { load(); }, [targetId]);

  return (
    <Layout>
      <div className="glass-strong rounded-3xl p-6 mb-4 flex items-center gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-display text-2xl font-bold">
          {profile?.display_name?.[0]?.toUpperCase() ?? "U"}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl font-bold truncate">{profile?.display_name ?? "User"}</h1>
          <div className="flex items-center gap-2 mt-1">
            {role && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">{role}</span>}
            <span className="text-xs text-muted-foreground">{posts.length} post{posts.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center text-muted-foreground">No posts yet.</div>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} onChange={load} />)
        )}
      </div>
    </Layout>
  );
}
