-- Retire the incomplete legacy public submission RPC now that the
-- server-side v2 endpoint is deployed. Keep profile helper RPCs available to
-- authenticated users only. The auth-user trigger remains attached to auth.users.

revoke execute
on function public.submit_invitation_request(text, text, text, text)
from public, anon, authenticated;

revoke execute
on function public.handle_new_auth_user()
from public, anon, authenticated;

revoke execute
on function public.can_manage_profile(uuid)
from public, anon;

revoke execute
on function public.can_view_profile(uuid)
from public, anon;

grant execute
on function public.can_manage_profile(uuid)
to authenticated;

grant execute
on function public.can_view_profile(uuid)
to authenticated;
