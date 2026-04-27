ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_story boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_posts_user_story ON public.posts(user_id, is_story, created_at DESC);

-- Update video expiry trigger to NOT override story expirations, and let stories default to 24h
CREATE OR REPLACE FUNCTION public.set_video_expiry()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_story THEN
    NEW.expires_at := COALESCE(NEW.expires_at, NEW.created_at + interval '24 hours');
  ELSIF NEW.media_kind = 'video' THEN
    NEW.expires_at := COALESCE(NEW.expires_at, NEW.created_at + interval '30 minutes');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS posts_set_expiry ON public.posts;
CREATE TRIGGER posts_set_expiry BEFORE INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.set_video_expiry();