-- 1. Update post video expiry: 3 days (stories stay at 24h)
CREATE OR REPLACE FUNCTION public.set_video_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_story THEN
    NEW.expires_at := COALESCE(NEW.expires_at, NEW.created_at + interval '24 hours');
  ELSIF NEW.media_kind = 'video' THEN
    NEW.expires_at := COALESCE(NEW.expires_at, NEW.created_at + interval '3 days');
  END IF;
  RETURN NEW;
END;
$function$;

-- Make sure trigger exists on posts
DROP TRIGGER IF EXISTS posts_set_expiry ON public.posts;
CREATE TRIGGER posts_set_expiry
BEFORE INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.set_video_expiry();

-- 2. Add expires_at to tiktok_reels (link-pasted reels) — 30 min default
ALTER TABLE public.tiktok_reels ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_tiktok_reel_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.expires_at := COALESCE(NEW.expires_at, NEW.created_at + interval '30 minutes');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tiktok_reels_set_expiry ON public.tiktok_reels;
CREATE TRIGGER tiktok_reels_set_expiry
BEFORE INSERT ON public.tiktok_reels
FOR EACH ROW EXECUTE FUNCTION public.set_tiktok_reel_expiry();

-- Make sure user_reels expiry trigger exists
DROP TRIGGER IF EXISTS user_reels_set_expiry ON public.user_reels;
CREATE TRIGGER user_reels_set_expiry
BEFORE INSERT ON public.user_reels
FOR EACH ROW EXECUTE FUNCTION public.set_user_reel_expiry();

-- 3. Update purge function to also clean expired tiktok_reels
CREATE OR REPLACE FUNCTION public.purge_expired_videos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.posts
  WHERE expires_at IS NOT NULL AND expires_at < now();
  DELETE FROM public.user_reels
  WHERE expires_at IS NOT NULL AND expires_at < now();
  DELETE FROM public.tiktok_reels
  WHERE expires_at IS NOT NULL AND expires_at < now();
END;
$function$;

-- 4. Reposts table
CREATE TABLE IF NOT EXISTS public.reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reposts viewable by authenticated" ON public.reposts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users repost as themselves" ON public.reposts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own reposts" ON public.reposts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. Bookmarks table
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own bookmarks" ON public.bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own bookmarks" ON public.bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own bookmarks" ON public.bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. Post views table — one row per (post, user)
CREATE TABLE IF NOT EXISTS public.post_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Views viewable by authenticated" ON public.post_views FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users mark own views" ON public.post_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS reposts_post_id_idx ON public.reposts(post_id);
CREATE INDEX IF NOT EXISTS bookmarks_user_id_idx ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS post_views_post_id_idx ON public.post_views(post_id);