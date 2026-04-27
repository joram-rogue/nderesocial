import { supabase } from "@/integrations/supabase/client";
import type { Post } from "@/components/PostCard";

export async function fetchPostsWithProfiles(filter?: { user_id?: string; includeStories?: boolean }): Promise<Post[]> {
  let q = supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(100);
  if (filter?.user_id) q = q.eq("user_id", filter.user_id);
  if (!filter?.includeStories) q = q.eq("is_story", false);
  const { data: posts, error } = await q;
  if (error || !posts) return [];
  const ids = [...new Set(posts.map((p) => p.user_id))];
  const { data: profs } = await supabase.from("profiles").select("id,display_name,avatar_url").in("id", ids);
  const m = new Map(profs?.map((p) => [p.id, p]));
  return posts.map((p) => ({ ...p, profile: m.get(p.user_id) as any })) as Post[];
}
