import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

const PERM_KEY = "ndere.notif.asked";

const labelFor = (type: string, name: string) => {
  switch (type) {
    case "follow": return `${name} started following you`;
    case "like": return `${name} liked your post`;
    case "comment": return `${name} commented on your post`;
    case "post": return `${name} shared a new post`;
    case "setup": return `Finish setting up your profile to get the full Ndere experience`;
    default: return `${name} sent you an update`;
  }
};

export const useNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default" && !localStorage.getItem(PERM_KEY)) {
      localStorage.setItem(PERM_KEY, "1");
      Notification.requestPermission().catch(() => {});
    }

    const ch = supabase
      .channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        async (payload: any) => {
          const n = payload.new;
          const { data: actor } = await supabase.from("profiles").select("display_name,avatar_url").eq("id", n.actor_id).maybeSingle();
          const name = actor?.display_name ?? "Someone";
          const text = labelFor(n.type, name);
          toast(text);
          try {
            if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
              new Notification("Ndere FAM", { body: text, icon: actor?.avatar_url ?? "/icon-192.png" });
            }
          } catch {/* ignore */}
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
};

/** Helper to create a notification (no-op if recipient is the actor). */
export const notify = async (params: { user_id: string; actor_id: string; type: "post" | "follow" | "like" | "comment"; post_id?: string }) => {
  if (params.user_id === params.actor_id) return;
  await supabase.from("notifications").insert({
    user_id: params.user_id,
    actor_id: params.actor_id,
    type: params.type,
    post_id: params.post_id ?? null,
  });
};

/** Notify all followers of a user. */
export const notifyFollowers = async (actor_id: string, type: "post", post_id?: string) => {
  const { data } = await supabase.from("follows").select("follower_id").eq("following_id", actor_id);
  if (!data?.length) return;
  const rows = data.map((r) => ({ user_id: r.follower_id, actor_id, type, post_id: post_id ?? null }));
  await supabase.from("notifications").insert(rows);
};

/** Notify every user on the platform (excluding the actor) about a new post. */
export const notifyAllUsers = async (actor_id: string, type: "post", post_id?: string) => {
  const { data } = await supabase.from("profiles").select("id").neq("id", actor_id);
  if (!data?.length) return;
  const rows = data.map((r) => ({ user_id: r.id, actor_id, type, post_id: post_id ?? null }));
  // Chunk to keep request size reasonable
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    await supabase.from("notifications").insert(rows.slice(i, i + chunk));
  }
};
