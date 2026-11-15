-- Invitation requests are intentionally consumed through scoped SECURITY DEFINER RPCs.
-- The authenticated role had a direct SELECT grant despite RLS having no SELECT policy.
-- Remove the redundant table privilege so a future permissive policy cannot expose
-- applicant personal data through the table endpoint by accident.

revoke select on table public.invitation_requests from authenticated;
