-- Allow any authenticated user to contribute reels; restrict deletes to the contributor or an admin.
DROP POLICY IF EXISTS "Admins insert reels" ON public.tiktok_reels;
DROP POLICY IF EXISTS "Admins delete reels" ON public.tiktok_reels;

CREATE POLICY "Authenticated users add reels"
ON public.tiktok_reels
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = added_by);

CREATE POLICY "Contributors or admins delete reels"
ON public.tiktok_reels
FOR DELETE
TO authenticated
USING (auth.uid() = added_by OR has_role(auth.uid(), 'admin'::app_role));