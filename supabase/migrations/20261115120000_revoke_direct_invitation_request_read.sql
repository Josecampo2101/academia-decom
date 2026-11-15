-- Invitation requests are intentionally consumed through scoped SECURITY DEFINER RPCs.
-- In production, authenticated had a direct SELECT grant while RLS had no SELECT policy.
-- get_invitation_requests validates the active session and limits results to national
-- administrators or district managers. The client does not need direct table reads.
-- Remove the redundant privilege so future policy changes cannot expose applicant PII
-- through the PostgREST table endpoint by accident.

revoke select on table public.invitation_requests from authenticated;
