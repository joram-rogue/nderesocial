-- 1) post_views: restrict SELECT to own rows; expose counts via SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Views viewable by authenticated" ON public.post_views;
CREATE POLICY "Users view own post views"
  ON public.post_views FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_post_view_count(p_post_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint FROM public.post_views WHERE post_id = p_post_id;
$$;
REVOKE ALL ON FUNCTION public.get_post_view_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_post_view_count(uuid) TO authenticated;

-- 2) user_roles: own-only read + admin-only insert (kill self-escalation)
DROP POLICY IF EXISTS "Roles viewable by authenticated" ON public.user_roles;
CREATE POLICY "Users view own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users insert own role" ON public.user_roles;
CREATE POLICY "Only admins assign roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins remove roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) chat_messages: scope room visibility by role
DROP POLICY IF EXISTS "Chat visible to authenticated" ON public.chat_messages;
CREATE POLICY "Chat visible by room role"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    room = 'all'
    OR (room = 'staff'  AND public.has_role(auth.uid(), 'staff'))
    OR (room = 'troupe' AND public.has_role(auth.uid(), 'troupe'))
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Also restrict who can post into restricted rooms
DROP POLICY IF EXISTS "Users send chat as themselves" ON public.chat_messages;
CREATE POLICY "Users send chat as themselves"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      room = 'all'
      OR (room = 'staff'  AND public.has_role(auth.uid(), 'staff'))
      OR (room = 'troupe' AND public.has_role(auth.uid(), 'troupe'))
      OR public.has_role(auth.uid(), 'admin')
    )
  );