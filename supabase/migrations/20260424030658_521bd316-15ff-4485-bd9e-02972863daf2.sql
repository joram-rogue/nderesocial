
DROP POLICY IF EXISTS "Chat visible by room" ON public.chat_messages;
DROP POLICY IF EXISTS "Users send to allowed rooms" ON public.chat_messages;

CREATE POLICY "Chat visible to authenticated"
ON public.chat_messages FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users send chat as themselves"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
