
create table public.academic_activities (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id),
  course_id uuid not null,
  module_id uuid not null,
  lesson_id uuid not null,
  title text not null check (char_length(btrim(title)) between 3 and 180),
  description text,
  instructions text not null check (char_length(btrim(instructions)) >= 10),
  activity_type text not null default 'individual' check (activity_type in ('individual','reflection','project','workshop','practice')),
  response_type text not null default 'text' check (response_type in ('text','file','link','mixed')),
  total_points numeric(7,2) not null default 100 check (total_points > 0 and total_points <= 10000),
  max_attempts integer not null default 2 check (max_attempts between 1 and 10),
  due_at timestamptz,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid not null references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_activities_course_district_fk foreign key(course_id,district_id) references public.courses(id,district_id),
  constraint academic_activities_module_district_fk foreign key(module_id,district_id) references public.course_modules(id,district_id),
  constraint academic_activities_lesson_district_fk foreign key(lesson_id,district_id) references public.lessons(id,district_id),
  constraint academic_activities_id_district_unique unique(id,district_id)
);

create table public.academic_activity_rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  district_id uuid not null,
  title text not null check (char_length(btrim(title)) between 2 and 140),
  description text,
  max_points numeric(7,2) not null check (max_points > 0 and max_points <= 10000),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  constraint academic_activity_rubric_activity_fk foreign key(activity_id,district_id) references public.academic_activities(id,district_id) on delete cascade,
  constraint academic_activity_rubric_id_activity_unique unique(id,activity_id,district_id)
);

create table public.academic_activity_assignments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null,
  enrollment_id uuid not null references public.course_enrollments(id),
  district_id uuid not null references public.districts(id),
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  status text not null default 'active' check (status in ('active','cancelled')),
  constraint academic_activity_assignments_activity_fk foreign key(activity_id,district_id) references public.academic_activities(id,district_id),
  constraint academic_activity_assignments_unique unique(activity_id,enrollment_id),
  constraint academic_activity_assignments_id_identity_unique unique(id,activity_id,enrollment_id,district_id)
);

create table public.academic_activity_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  activity_id uuid not null,
  enrollment_id uuid not null,
  district_id uuid not null,
  user_id uuid not null references auth.users(id),
  attempt_number integer not null check (attempt_number between 1 and 10),
  response_text text,
  external_url text,
  status text not null default 'draft' check (status in ('draft','submitted','changes_requested','graded')),
  awarded_points numeric(7,2),
  feedback text,
  rubric_scores jsonb not null default '[]'::jsonb check (jsonb_typeof(rubric_scores) = 'array'),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_activity_submissions_assignment_fk foreign key(assignment_id,activity_id,enrollment_id,district_id)
    references public.academic_activity_assignments(id,activity_id,enrollment_id,district_id),
  constraint academic_activity_submissions_attempt_unique unique(assignment_id,attempt_number),
  constraint academic_activity_submissions_id_identity_unique unique(id,activity_id,district_id,user_id),
  constraint academic_activity_submissions_awarded_check check (awarded_points is null or awarded_points >= 0)
);

create table public.academic_activity_submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  activity_id uuid not null,
  district_id uuid not null,
  user_id uuid not null references auth.users(id),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  created_at timestamptz not null default now(),
  constraint academic_activity_submission_files_submission_fk foreign key(submission_id,activity_id,district_id,user_id)
    references public.academic_activity_submissions(id,activity_id,district_id,user_id) on delete cascade
);

create index academic_activities_course_status_idx on public.academic_activities(district_id,course_id,status);
create index academic_activities_lesson_idx on public.academic_activities(district_id,lesson_id,status);
create index academic_activity_rubric_activity_order_idx on public.academic_activity_rubric_criteria(activity_id,sort_order);
create index academic_activity_assignments_enrollment_status_idx on public.academic_activity_assignments(enrollment_id,status);
create index academic_activity_assignments_district_activity_idx on public.academic_activity_assignments(district_id,activity_id);
create index academic_activity_submissions_assignment_status_idx on public.academic_activity_submissions(assignment_id,status,attempt_number desc);
create index academic_activity_submissions_user_created_idx on public.academic_activity_submissions(user_id,created_at desc);
create index academic_activity_submission_files_submission_idx on public.academic_activity_submission_files(submission_id);

alter table public.academic_activities enable row level security;
alter table public.academic_activity_rubric_criteria enable row level security;
alter table public.academic_activity_assignments enable row level security;
alter table public.academic_activity_submissions enable row level security;
alter table public.academic_activity_submission_files enable row level security;

create policy academic_activities_select_scope on public.academic_activities
for select to authenticated using (
  private.can_manage_lesson_resources(district_id)
  or (status = 'published' and exists (
    select 1 from public.course_enrollments e
    where e.course_id = academic_activities.course_id
      and e.district_id = academic_activities.district_id
      and e.user_id = (select auth.uid()) and e.status = 'active'
  ))
);
create policy academic_activities_insert_managers on public.academic_activities
for insert to authenticated with check (
  private.can_manage_lesson_resources(district_id)
  and created_by = (select auth.uid()) and status = 'draft'
);
create policy academic_activities_update_managers on public.academic_activities
for update to authenticated using (private.can_manage_lesson_resources(district_id))
with check (private.can_manage_lesson_resources(district_id)
  and (status <> 'published' or private.can_manage_academic_catalog(district_id)));
create policy academic_activities_delete_drafts on public.academic_activities
for delete to authenticated using (private.can_manage_lesson_resources(district_id) and status = 'draft');

create policy academic_activity_rubric_select_scope on public.academic_activity_rubric_criteria
for select to authenticated using (
  private.can_manage_lesson_resources(district_id)
  or exists (
    select 1 from public.academic_activities a
    join public.course_enrollments e on e.course_id = a.course_id and e.district_id = a.district_id
    where a.id = academic_activity_rubric_criteria.activity_id and a.status = 'published'
      and e.user_id = (select auth.uid()) and e.status = 'active'
  )
);
create policy academic_activity_rubric_manage on public.academic_activity_rubric_criteria
for all to authenticated using (private.can_manage_lesson_resources(district_id))
with check (private.can_manage_lesson_resources(district_id));

create policy academic_activity_assignments_select_scope on public.academic_activity_assignments
for select to authenticated using (
  private.can_manage_lesson_resources(district_id)
  or exists (select 1 from public.course_enrollments e
    where e.id = academic_activity_assignments.enrollment_id and e.user_id = (select auth.uid()))
);
create policy academic_activity_assignments_insert_managers on public.academic_activity_assignments
for insert to authenticated with check (
  private.can_manage_lesson_resources(district_id)
  and assigned_by = (select auth.uid()) and status = 'active'
  and exists (
    select 1 from public.academic_activities a
    join public.course_enrollments e on e.course_id = a.course_id and e.district_id = a.district_id
    where a.id = academic_activity_assignments.activity_id
      and a.district_id = academic_activity_assignments.district_id
      and a.status = 'published'
      and e.id = academic_activity_assignments.enrollment_id and e.status = 'active'
  )
);
create policy academic_activity_assignments_update_managers on public.academic_activity_assignments
for update to authenticated using (private.can_manage_lesson_resources(district_id))
with check (private.can_manage_lesson_resources(district_id));
create policy academic_activity_assignments_delete_managers on public.academic_activity_assignments
for delete to authenticated using (private.can_manage_lesson_resources(district_id));

create policy academic_activity_submissions_select_scope on public.academic_activity_submissions
for select to authenticated using (
  user_id = (select auth.uid()) or private.can_manage_lesson_resources(district_id)
);
create policy academic_activity_submissions_insert_draft on public.academic_activity_submissions
for insert to authenticated with check (
  user_id = (select auth.uid()) and status = 'draft'
  and reviewed_by is null and reviewed_at is null and awarded_points is null
  and exists (
    select 1 from public.academic_activity_assignments a
    join public.course_enrollments e on e.id = a.enrollment_id
    join public.academic_activities act on act.id = a.activity_id
    where a.id = academic_activity_submissions.assignment_id
      and a.activity_id = academic_activity_submissions.activity_id
      and a.enrollment_id = academic_activity_submissions.enrollment_id
      and a.district_id = academic_activity_submissions.district_id
      and e.user_id = (select auth.uid()) and e.status = 'active'
      and a.status = 'active' and act.status = 'published'
  )
);
create policy academic_activity_submissions_update_draft on public.academic_activity_submissions
for update to authenticated using (user_id = (select auth.uid()) and status = 'draft')
with check (user_id = (select auth.uid()) and status = 'draft'
  and reviewed_by is null and reviewed_at is null and awarded_points is null);
create policy academic_activity_submissions_delete_draft on public.academic_activity_submissions
for delete to authenticated using (user_id = (select auth.uid()) and status = 'draft');

create policy academic_activity_submission_files_select_scope on public.academic_activity_submission_files
for select to authenticated using (
  user_id = (select auth.uid()) or private.can_manage_lesson_resources(district_id)
);
create policy academic_activity_submission_files_insert_draft on public.academic_activity_submission_files
for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.academic_activity_submissions s
    where s.id = academic_activity_submission_files.submission_id
      and s.activity_id = academic_activity_submission_files.activity_id
      and s.district_id = academic_activity_submission_files.district_id
      and s.user_id = (select auth.uid()) and s.status = 'draft'
  )
);
create policy academic_activity_submission_files_delete_draft on public.academic_activity_submission_files
for delete to authenticated using (
  user_id = (select auth.uid())
  and exists (select 1 from public.academic_activity_submissions s
    where s.id = academic_activity_submission_files.submission_id and s.status = 'draft')
);

create or replace function public.start_academic_activity_submission(p_assignment_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  v_assignment public.academic_activity_assignments%rowtype;
  v_activity public.academic_activities%rowtype;
  v_enrollment public.course_enrollments%rowtype;
  v_attempt integer;
  v_submission_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_assignment from public.academic_activity_assignments
    where id = p_assignment_id for update;
  if not found or v_assignment.status <> 'active' then raise exception 'Assignment unavailable'; end if;
  select * into v_activity from public.academic_activities where id = v_assignment.activity_id;
  select * into v_enrollment from public.course_enrollments where id = v_assignment.enrollment_id;
  if v_enrollment.user_id <> (select auth.uid()) or v_enrollment.status <> 'active'
     or v_activity.status <> 'published' then raise exception 'Assignment unavailable'; end if;
  if coalesce(v_assignment.due_at,v_activity.due_at) is not null
     and now() > coalesce(v_assignment.due_at,v_activity.due_at) then raise exception 'Submission deadline has passed'; end if;
  select coalesce(max(attempt_number),0)+1 into v_attempt
    from public.academic_activity_submissions where assignment_id = p_assignment_id;
  if v_attempt > v_activity.max_attempts then raise exception 'Maximum attempts reached'; end if;
  insert into public.academic_activity_submissions(
    assignment_id,activity_id,enrollment_id,district_id,user_id,attempt_number,status
  ) values (
    v_assignment.id,v_assignment.activity_id,v_assignment.enrollment_id,v_assignment.district_id,
    (select auth.uid()),v_attempt,'draft'
  ) returning id into v_submission_id;
  return v_submission_id;
end;
$function$;

create or replace function public.submit_academic_activity_submission(p_submission_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_submission public.academic_activity_submissions%rowtype;
  v_activity public.academic_activities%rowtype;
  v_assignment public.academic_activity_assignments%rowtype;
  v_has_files boolean;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_submission from public.academic_activity_submissions
    where id = p_submission_id for update;
  if not found or v_submission.user_id <> (select auth.uid()) or v_submission.status <> 'draft'
    then raise exception 'Draft unavailable'; end if;
  select * into v_activity from public.academic_activities where id = v_submission.activity_id;
  select * into v_assignment from public.academic_activity_assignments where id = v_submission.assignment_id;
  if v_assignment.status <> 'active' or v_activity.status <> 'published' then raise exception 'Assignment unavailable'; end if;
  if coalesce(v_assignment.due_at,v_activity.due_at) is not null
     and now() > coalesce(v_assignment.due_at,v_activity.due_at) then raise exception 'Submission deadline has passed'; end if;
  select exists(select 1 from public.academic_activity_submission_files f where f.submission_id = p_submission_id) into v_has_files;
  if nullif(btrim(v_submission.response_text),'') is null
     and nullif(btrim(v_submission.external_url),'') is null and not v_has_files then
    raise exception 'Add a response, a link, or at least one attachment';
  end if;
  update public.academic_activity_submissions
    set status = 'submitted', submitted_at = now(), updated_at = now()
    where id = p_submission_id;
end;
$function$;

create or replace function public.review_academic_activity_submission(
  p_submission_id uuid, p_awarded_points numeric, p_feedback text,
  p_status text default 'graded', p_rubric_scores jsonb default '[]'::jsonb
)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_submission public.academic_activity_submissions%rowtype;
  v_activity public.academic_activities%rowtype;
  v_score jsonb;
  v_sum numeric := 0;
  v_expected integer := 0;
  v_received integer := 0;
  v_points numeric;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_status not in ('graded','changes_requested') then raise exception 'Invalid review status'; end if;
  if p_status = 'changes_requested' and nullif(btrim(p_feedback),'') is null then
    raise exception 'Feedback is required when changes are requested';
  end if;
  select * into v_submission from public.academic_activity_submissions
    where id = p_submission_id for update;
  if not found or not private.can_manage_lesson_resources(v_submission.district_id) then
    raise exception 'Not authorized to review this submission';
  end if;
  if v_submission.status not in ('submitted','changes_requested') then raise exception 'Submission is not awaiting review'; end if;
  select * into v_activity from public.academic_activities where id = v_submission.activity_id;
  select count(*) into v_expected from public.academic_activity_rubric_criteria
    where activity_id = v_submission.activity_id;
  if v_expected > 0 then
    if jsonb_typeof(p_rubric_scores) <> 'array' then raise exception 'Invalid rubric scores'; end if;
    for v_score in select value from jsonb_array_elements(p_rubric_scores)
    loop
      select c.max_points into v_points from public.academic_activity_rubric_criteria c
      where c.id = (v_score->>'criterion_id')::uuid and c.activity_id = v_submission.activity_id;
      if not found then raise exception 'Rubric criterion not found'; end if;
      if (v_score->>'awarded_points') is null then raise exception 'Missing awarded points'; end if;
      if (v_score->>'awarded_points')::numeric < 0 or (v_score->>'awarded_points')::numeric > v_points then
        raise exception 'Rubric score exceeds criterion limit';
      end if;
      v_sum := v_sum + (v_score->>'awarded_points')::numeric;
      v_received := v_received + 1;
    end loop;
    if v_received <> v_expected then raise exception 'Score every rubric criterion exactly once'; end if;
    if exists (
      select 1 from (
        select (value->>'criterion_id')::uuid as criterion_id, count(*) as amount
        from jsonb_array_elements(p_rubric_scores) group by 1 having count(*) > 1
      ) duplicate_scores
    ) then raise exception 'Duplicate rubric criterion score'; end if;
    if p_awarded_points is distinct from v_sum then raise exception 'Total score must equal the rubric sum'; end if;
  end if;
  if p_awarded_points < 0 or p_awarded_points > v_activity.total_points then raise exception 'Score outside activity range'; end if;
  update public.academic_activity_submissions
    set status = p_status,
        awarded_points = case when p_status = 'graded' then p_awarded_points else null end,
        feedback = nullif(btrim(p_feedback),''),
        rubric_scores = case when p_status = 'graded' then coalesce(p_rubric_scores,'[]'::jsonb) else '[]'::jsonb end,
        reviewed_by = (select auth.uid()), reviewed_at = now(), updated_at = now()
    where id = p_submission_id;
end;
$function$;

revoke all on function public.start_academic_activity_submission(uuid) from public, anon;
revoke all on function public.submit_academic_activity_submission(uuid) from public, anon;
revoke all on function public.review_academic_activity_submission(uuid,numeric,text,text,jsonb) from public, anon;
grant execute on function public.start_academic_activity_submission(uuid) to authenticated;
grant execute on function public.submit_academic_activity_submission(uuid) to authenticated;
grant execute on function public.review_academic_activity_submission(uuid,numeric,text,text,jsonb) to authenticated;

grant select,insert,update,delete on public.academic_activities, public.academic_activity_rubric_criteria,
  public.academic_activity_assignments, public.academic_activity_submissions,
  public.academic_activity_submission_files to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('academic-activity-submissions','academic-activity-submissions',false,52428800,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/wav','video/mp4','video/webm','text/plain','text/markdown'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy academic_activity_submission_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id='academic-activity-submissions'
  and exists (
    select 1 from public.academic_activity_submissions s
    where s.id=(storage.foldername(name))[3]::uuid
      and s.district_id=(storage.foldername(name))[1]::uuid
      and s.user_id=(storage.foldername(name))[2]::uuid
      and s.user_id=(select auth.uid()) and s.status='draft'
  )
);
create policy academic_activity_submission_storage_select on storage.objects
for select to authenticated using (
  bucket_id='academic-activity-submissions'
  and exists (
    select 1 from public.academic_activity_submission_files f
    where f.storage_path=objects.name
      and (f.user_id=(select auth.uid()) or private.can_manage_lesson_resources(f.district_id))
  )
);
create policy academic_activity_submission_storage_delete on storage.objects
for delete to authenticated using (
  bucket_id='academic-activity-submissions'
  and exists (
    select 1 from public.academic_activity_submission_files f
    join public.academic_activity_submissions s on s.id=f.submission_id
    where f.storage_path=objects.name and f.user_id=(select auth.uid()) and s.status='draft'
  )
);
