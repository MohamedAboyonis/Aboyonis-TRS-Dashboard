-- TRS Field Ops — multi-tenant cloud schema (PostgreSQL / Supabase)
-- Step 2 of the roadmap: lets every phone / PC of a company share the same data in real time.
-- Every row carries company_id; Row Level Security restricts users to their own company.
-- Table shapes mirror src/lib/types.ts.

create extension if not exists "pgcrypto";

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  logo_url text,
  primary_color text default '#0f4c81',
  currency text default 'USD',
  country text, address text, phone text, email text,
  license_key text,
  lists jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  description text,
  permissions text[] not null default '{}',
  system boolean default false
);

create table employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id),   -- set when the employee has an app login
  emp_no text not null,
  name text not null,
  position text, department text,
  phone text, email text, national_id text, passport_no text, photo_url text,
  join_date date,
  active boolean default true,
  role_id uuid references roles(id),
  extra_permissions text[] default '{}',
  unique (company_id, emp_no)
);

create table rigs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null, customer text, field text, well text,
  status text not null default 'Operating',
  updated_at timestamptz default now(), updated_by uuid references employees(id)
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  job_no text not null,
  rig_id uuid references rigs(id),
  customer text, well text, service_type text, tool_type text,
  sizes text[] default '{}',
  start_date date not null, end_date date,
  status text not null default 'Planned',
  revenue numeric, hours numeric, joints int, npt_hours numeric, npt_category text, notes text,
  unique (company_id, job_no)
);

create table rig_operations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  rig_id uuid not null references rigs(id) on delete cascade,
  kind text not null check (kind in ('current','next','history')),
  description text not null,
  job_id uuid references jobs(id),
  planned_date date, started_at date, ended_at date, notes text
);

create table crew_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  employee_id uuid not null references employees(id),
  crew_role text, start_date date not null, end_date date,
  registered_by uuid references employees(id), created_at timestamptz default now()
);

create table leaves (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id),
  type text not null, start_date date not null, end_date date not null,
  status text not null default 'Pending', note text, file_path text,
  decided_by uuid references employees(id), created_at timestamptz default now()
);

create table timesheet_overrides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id),
  date date not null, code text not null, note text,
  by uuid references employees(id), at timestamptz default now(),
  unique (employee_id, date)
);

create table workshop_preps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  job_no text not null, job_id uuid references jobs(id), rig_id uuid references rigs(id),
  sizes jsonb not null default '[]', equipment_ids uuid[] default '{}', assigned_to uuid[] default '{}',
  required_date date, status text not null default 'Requested',
  checklist jsonb not null default '[]', notes text,
  created_at timestamptz default now(), created_by uuid references employees(id)
);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  category text not null check (category in ('HSE','Technical','Identification')),
  name text not null, number text, issuer text, issue_date date, expiry_date date, file_path text
);

create table training_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  position text not null, cert_name text not null, category text not null
);

create table equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  asset_no text not null, name text not null, type text, serial_no text, size text,
  manufacturer text, model text, location text, status text not null default 'Available',
  maint_interval_days int, notes text,
  unique (company_id, asset_no)
);

create table maintenance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  equipment_id uuid not null references equipment(id) on delete cascade,
  date date not null, type text not null, description text not null,
  performed_by text, cost numeric, next_due date, file_path text
);

create table equipment_docs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  equipment_id uuid not null references equipment(id) on delete cascade,
  kind text not null, number text, issuer text, issue_date date, expiry_date date, file_path text
);

create table hse_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  type text not null, date date not null, rig_id uuid references rigs(id), job_id uuid references jobs(id),
  description text not null, action text, status text default 'Open',
  reported_by text, file_path text
);

create table audit_log (
  id bigserial primary key,
  company_id uuid not null references companies(id) on delete cascade,
  at timestamptz default now(), by uuid references employees(id), action text not null
);

-- ---------- Row Level Security ----------
create or replace function my_company() returns uuid language sql stable security definer as $$
  select company_id from employees where auth_user_id = auth.uid() and active
$$;

create or replace function has_perm(p text) returns boolean language sql stable security definer as $$
  select exists (
    select 1 from employees e left join roles r on r.id = e.role_id
    where e.auth_user_id = auth.uid() and e.active
      and (r.name = 'Administrator' or p = any(r.permissions) or p = any(e.extra_permissions))
  )
$$;

do $$
declare t text;
begin
  foreach t in array array['roles','employees','rigs','jobs','rig_operations','crew_assignments','leaves',
    'timesheet_overrides','workshop_preps','certificates','training_requirements','equipment',
    'maintenance_records','equipment_docs','hse_events','audit_log'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy tenant_read on %I for select using (company_id = my_company())', t);
  end loop;
end $$;

alter table companies enable row level security;
create policy company_read on companies for select using (id = my_company());
create policy company_write on companies for update using (id = my_company() and has_perm('admin.company'));

-- Write policies by permission (examples; mirror src/lib/permissions.ts)
create policy rigs_write on rigs for all using (company_id = my_company() and has_perm('ops.manage')) with check (company_id = my_company());
create policy jobs_write on jobs for all using (company_id = my_company() and has_perm('ops.manage')) with check (company_id = my_company());
create policy ops_write on rig_operations for all using (company_id = my_company() and has_perm('ops.manage')) with check (company_id = my_company());
create policy crew_self on crew_assignments for all using (
  company_id = my_company() and (has_perm('timesheet.manage') or employee_id in (select id from employees where auth_user_id = auth.uid()))
) with check (company_id = my_company());
create policy leave_self on leaves for insert with check (
  company_id = my_company() and (has_perm('timesheet.manage') or employee_id in (select id from employees where auth_user_id = auth.uid()))
);
create policy leave_approve on leaves for update using (company_id = my_company() and has_perm('leave.approve'));
create policy override_write on timesheet_overrides for all using (company_id = my_company() and has_perm('timesheet.manage')) with check (company_id = my_company());
create policy prep_write on workshop_preps for all using (company_id = my_company() and has_perm('workshop.manage')) with check (company_id = my_company());
create policy cert_write on certificates for all using (company_id = my_company() and has_perm('hse.manage')) with check (company_id = my_company());
create policy treq_write on training_requirements for all using (company_id = my_company() and has_perm('hse.manage')) with check (company_id = my_company());
create policy hse_write on hse_events for all using (company_id = my_company() and (has_perm('hse.manage') or has_perm('field.register'))) with check (company_id = my_company());
create policy eq_write on equipment for all using (company_id = my_company() and has_perm('equipment.manage')) with check (company_id = my_company());
create policy mt_write on maintenance_records for all using (company_id = my_company() and has_perm('equipment.manage')) with check (company_id = my_company());
create policy ed_write on equipment_docs for all using (company_id = my_company() and has_perm('equipment.manage')) with check (company_id = my_company());
create policy emp_write on employees for all using (company_id = my_company() and has_perm('employees.manage')) with check (company_id = my_company());
create policy role_write on roles for all using (company_id = my_company() and has_perm('admin.access')) with check (company_id = my_company());

-- Files (certificate scans, COC, sick notes) go to a private Storage bucket at
--   <company_id>/<table>/<record_id>/<filename>   with a storage policy on the first path segment = my_company().
