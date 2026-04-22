-- expires_at on posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_video_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.media_kind = 'video' THEN
    NEW.expires_at := COALESCE(NEW.expires_at, NEW.created_at + interval '30 minutes');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_set_video_expiry ON public.posts;
CREATE TRIGGER posts_set_video_expiry
BEFORE INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.set_video_expiry();

DROP POLICY IF EXISTS "Posts visible by audience" ON public.posts;
CREATE POLICY "Posts visible by audience"
ON public.posts FOR SELECT TO authenticated
USING (
  (expires_at IS NULL OR expires_at > now())
  AND (
    audience = 'all'::post_audience
    OR (audience = 'staff'::post_audience AND has_role(auth.uid(), 'staff'::app_role))
    OR (audience = 'troupe'::post_audience AND has_role(auth.uid(), 'troupe'::app_role))
    OR user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.purge_expired_videos()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.posts
  WHERE media_kind = 'video' AND expires_at IS NOT NULL AND expires_at < now();
END;
$$;

-- tiktok_reels
CREATE TABLE IF NOT EXISTS public.tiktok_reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_url text NOT NULL,
  video_id text NOT NULL,
  author_handle text,
  added_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tiktok_reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reels viewable by authenticated"
ON public.tiktok_reels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert reels"
ON public.tiktok_reels FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) AND auth.uid() = added_by);
CREATE POLICY "Admins delete reels"
ON public.tiktok_reels FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room public.post_audience NOT NULL DEFAULT 'all',
  user_id uuid NOT NULL,
  content text,
  voice_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat visible by room"
ON public.chat_messages FOR SELECT TO authenticated
USING (
  room = 'all'::post_audience
  OR (room = 'staff'::post_audience AND has_role(auth.uid(), 'staff'::app_role))
  OR (room = 'troupe'::post_audience AND has_role(auth.uid(), 'troupe'::app_role))
);
CREATE POLICY "Users send to allowed rooms"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    room = 'all'::post_audience
    OR (room = 'staff'::post_audience AND has_role(auth.uid(), 'staff'::app_role))
    OR (room = 'troupe'::post_audience AND has_role(auth.uid(), 'troupe'::app_role))
  )
);
CREATE POLICY "Users delete own messages"
ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- voice-notes bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Voice notes public read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'voice-notes');
CREATE POLICY "Users upload own voice notes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own voice notes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'voice-notes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- pg_cron purge every 5 min
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'purge-expired-videos',
  '*/5 * * * *',
  $$ SELECT public.purge_expired_videos(); $$
);