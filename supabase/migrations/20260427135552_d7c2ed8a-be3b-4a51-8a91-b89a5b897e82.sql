-- Reel likes
CREATE TABLE IF NOT EXISTS public.reel_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL,
  reel_kind text NOT NULL CHECK (reel_kind IN ('user','external')),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reel_id, user_id)
);
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reel likes viewable by authenticated"
  ON public.reel_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users like as themselves"
  ON public.reel_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own reel likes"
  ON public.reel_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Reel comments
CREATE TABLE IF NOT EXISTS public.reel_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL,
  reel_kind text NOT NULL CHECK (reel_kind IN ('user','external')),
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reel comments viewable by authenticated"
  ON public.reel_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users comment as themselves"
  ON public.reel_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reel comments"
  ON public.reel_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reel_likes_reel ON public.reel_likes(reel_id);
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel ON public.reel_comments(reel_id, created_at);

-- Auto-expire user reels after 24h
ALTER TABLE public.user_reels ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_user_reel_expiry()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.expires_at := COALESCE(NEW.expires_at, NEW.created_at + interval '24 hours');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS user_reels_set_expiry ON public.user_reels;
CREATE TRIGGER user_reels_set_expiry BEFORE INSERT ON public.user_reels
FOR EACH ROW EXECUTE FUNCTION public.set_user_reel_expiry();

-- Backfill existing rows so the timer applies retroactively
UPDATE public.user_reels SET expires_at = created_at + interval '24 hours' WHERE expires_at IS NULL;

-- Extend purge to also clear expired reels
CREATE OR REPLACE FUNCTION public.purge_expired_videos()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.posts
  WHERE media_kind = 'video' AND expires_at IS NOT NULL AND expires_at < now();
  DELETE FROM public.user_reels
  WHERE expires_at IS NOT NULL AND expires_at < now();
END;
$function$;