CREATE TABLE public.user_reels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User reels viewable by authenticated"
ON public.user_reels FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users post their own reels"
ON public.user_reels FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors or admins delete reels"
ON public.user_reels FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX user_reels_created_at_idx ON public.user_reels (created_at DESC);