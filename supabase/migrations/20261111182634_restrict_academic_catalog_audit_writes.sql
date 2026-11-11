-- Audit events are append-only through trusted database triggers.
revoke all privileges on public.academic_catalog_events
from public, anon, authenticated;

grant select on public.academic_catalog_events to authenticated;
