import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Layout } from "@/components/Layout";
import { PostsGrid } from "@/components/PostsGrid";
import { type Post } from "@/components/PostCard";
import { ProfileEditor } from "@/components/ProfileEditor";
import { InviteSheet } from "@/components/InviteSheet";
import { StoriesStrip } from "@/components/StoriesStrip";
import { ThemeSettings } from "@/components/ThemeSettings";
import { fetchPostsWithProfiles } from "@/lib/posts";
import { notify } from "@/hooks/useNotifications";
import { Pencil, Palette, Share2, Radio, UserPlus, UserCheck, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function Account() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  useTheme();
  const targetId = id || user?.id;
  const isSelf = !id || id === user?.id;
  const [profile, setProfile] = useState<{ display_name: string; bio: string | null; avatar_url: string | null } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [likesTotal, setLikesTotal] = useState(0);
  const [iFollow, setIFollow] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const load = async () => {
    if (!targetId) return;
    const { data: p } = await supabase.from("profiles").select("display_name,bio,avatar_url").eq("id", targetId).maybeSingle();
    setProfile(p);
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", targetId).maybeSingle();
    setRole(r?.role ?? null);
    setPosts(await fetchPostsWithProfiles({ user_id: targetId }));

    // Stats
    const [{ count: fc }, { count: fgc }, { data: postIds }] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", targetId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", targetId),
      supabase.from("posts").select("id").eq("user_id", targetId),
    ]);
    setFollowers(fc ?? 0);
    setFollowing(fgc ?? 0);

    if (postIds && postIds.length > 0) {
      const { count: lc } = await supabase
        .from("likes").select("*", { count: "exact", head: true })
        .in("post_id", postIds.map((p: any) => p.id));
      setLikesTotal(lc ?? 0);
    } else setLikesTotal(0);

    if (user && !isSelf) {
      const { data: f } = await supabase.from("follows")
        .select("id").eq("follower_id", user.id).eq("following_id", targetId).maybeSingle();
      setIFollow(!!f);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [targetId, user?.id]);

  const toggleFollow = async () => {
    if (!user || !targetId) return;
    setFollowBusy(true);
    if (iFollow) {
      const { error } = await supabase.from("follows").delete()
        .eq("follower_id", user.id).eq("following_id", targetId);
      if (error) toast.error(error.message);
      else { setIFollow(false); setFollowers((n) => Math.max(0, n - 1)); }
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId });
      if (error) toast.error(error.message);
      else {
        setIFollow(true); setFollowers((n) => n + 1);
        notify({ user_id: targetId, actor_id: user.id, type: "follow" }).catch(() => {});
      }
    }
    setFollowBusy(false);
  };

  const messageUser = () => {
    if (!targetId) return;
    navigate(`/chat?dm=${targetId}`);
  };

  return (
    <Layout>
      <div className="glass-strong rounded-3xl p-6 mb-4 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-accent grid place-items-center text-primary-foreground font-display text-2xl font-bold">
                {profile?.display_name?.[0]?.toUpperCase() ?? "U"}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold truncate">{profile?.display_name ?? "User"}</h1>
            <div className="flex items-center gap-2 mt-1">
              {role && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">{role}</span>}
            </div>
          </div>
          {isSelf && (
            <div className="flex items-center gap-2">
              <button onClick={() => setThemeOpen(true)} className="p-2.5 rounded-xl glass hover:bg-primary/10 text-primary" aria-label="Theme & wallpaper" title="Theme, wallpaper & font">
                <Palette className="w-4 h-4" />
              </button>
              <button onClick={() => setEditing(true)} className="p-2.5 rounded-xl glass hover:bg-primary/10 text-primary" aria-label="Edit">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mt-5 text-center">
          <Stat label="Posts" value={posts.length} />
          <Stat label="Followers" value={followers} />
          <Stat label="Following" value={following} />
          <Stat label="Likes" value={likesTotal} />
        </div>

        {profile?.bio && <p className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>}

        {/* Action row */}
        <div className="mt-5 flex flex-wrap gap-2">
          {!isSelf && user && (
            <>
              <button
                onClick={toggleFollow}
                disabled={followBusy}
                className={`flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  iFollow ? "glass text-foreground" : "bg-gradient-to-r from-primary to-accent text-primary-foreground"
                }`}
              >
                {iFollow ? <><UserCheck className="w-4 h-4" /> Following</> : <><UserPlus className="w-4 h-4" /> Follow</>}
              </button>
              <button
                onClick={messageUser}
                className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold glass hover:bg-primary/10 text-primary"
              >
                <MessageCircle className="w-4 h-4" /> Message
              </button>
            </>
          )}
          {isSelf && (
            <Link to="/live" className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors">
              <Radio className="w-4 h-4" /> Go Live
            </Link>
          )}
          <button onClick={() => setInviteOpen(true)} className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold glass hover:bg-primary/10">
            <Share2 className="w-4 h-4" /> Invite
          </button>
        </div>
      </div>

      {/* Stories strip */}
      <div className="glass rounded-3xl px-4 py-3 mb-4">
        <StoriesStrip
          profileUserId={targetId!}
          isSelf={isSelf}
          displayName={profile?.display_name}
          avatarUrl={profile?.avatar_url}
        />
      </div>

      {/* Posts grid (excludes stories and reels) */}
      <PostsGrid posts={posts} onChange={load} />

      {editing && profile && (
        <ProfileEditor initial={profile} onSaved={load} onClose={() => setEditing(false)} />
      )}
      {inviteOpen && <InviteSheet onClose={() => setInviteOpen(false)} />}
      {themeOpen && <ThemeSettings onClose={() => setThemeOpen(false)} />}
    </Layout>
  );
}

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="glass rounded-2xl py-2">
    <div className="font-display font-bold text-base leading-tight">{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
  </div>
);
