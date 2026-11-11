-- Grant the authenticated application role the table-level privileges
-- required by the invitation management UI. RLS policies continue to scope
-- every read, insert, and update; anonymous users receive no access.

grant select, insert, update
on table public.invitations
to authenticated;
