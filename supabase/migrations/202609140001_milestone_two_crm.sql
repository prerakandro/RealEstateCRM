-- Milestone 2 CRM schema and workflow primitives.
create type public.customer_type as enum ('buyer', 'tenant', 'investor', 'seller', 'other');
create type public.customer_status as enum ('new', 'active', 'converted', 'inactive', 'closed');
create type public.lead_source as enum ('website', 'property_enquiry', 'referral', 'phone', 'walk_in', 'social_media', 'other');
create type public.lead_status as enum ('new', 'contacted', 'qualified', 'site_visit_scheduled', 'negotiation', 'converted', 'lost', 'closed');
create type public.lead_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.follow_up_type as enum ('call', 'whatsapp', 'email', 'meeting', 'other');
create type public.follow_up_status as enum ('pending', 'completed', 'cancelled', 'missed');
create type public.site_visit_status as enum ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled');

create table public.customers (
  id uuid primary key default gen_random_uuid(), full_name text not null check (length(trim(full_name)) >= 2),
  email text, phone text, alternate_phone text, source public.lead_source not null default 'other',
  customer_type public.customer_type not null default 'other', customer_status public.customer_status not null default 'new',
  preferred_location text, preferred_property_type public.property_type, preferred_listing_type public.listing_type,
  budget_min numeric(14,2) check (budget_min >= 0), budget_max numeric(14,2) check (budget_max >= 0 and (budget_min is null or budget_max >= budget_min)),
  bedrooms_required integer check (bedrooms_required is null or bedrooms_required >= 0), notes text,
  assigned_agent_id uuid references public.profiles(id) on delete set null, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index customers_email_unique on public.customers(lower(email)) where email is not null;

create table public.leads (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete restrict,
  property_id uuid references public.properties(id) on delete set null, title text not null,
  source public.lead_source not null default 'other', status public.lead_status not null default 'new',
  priority public.lead_priority not null default 'medium', assigned_agent_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null, notes text, expected_budget numeric(14,2) check (expected_budget >= 0),
  next_follow_up_at timestamptz, contacted_at timestamptz, qualified_at timestamptz, converted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(), lead_id uuid references public.leads(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade, assigned_agent_id uuid references public.profiles(id) on delete set null,
  title text not null, notes text, follow_up_type public.follow_up_type not null default 'call', status public.follow_up_status not null default 'pending',
  priority public.lead_priority not null default 'medium', scheduled_at timestamptz not null, completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (completed_at is null or status = 'completed')
);

create table public.site_visits (
  id uuid primary key default gen_random_uuid(), lead_id uuid references public.leads(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade, property_id uuid not null references public.properties(id) on delete restrict,
  agent_id uuid references public.profiles(id) on delete set null, scheduled_at timestamptz not null,
  status public.site_visit_status not null default 'scheduled', notes text, outcome text,
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete set null,
  entity_type text not null, entity_id uuid, action text not null, description text not null, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, message text not null, type text not null, entity_type text, entity_id uuid,
  is_read boolean not null default false, created_at timestamptz not null default now()
);

create index customers_agent_idx on public.customers(assigned_agent_id, updated_at desc);
create index leads_agent_status_idx on public.leads(assigned_agent_id, status, priority, updated_at desc);
create index leads_customer_idx on public.leads(customer_id); create index leads_property_idx on public.leads(property_id);
create index follow_ups_schedule_idx on public.follow_ups(assigned_agent_id, status, scheduled_at);
create index site_visits_schedule_idx on public.site_visits(agent_id, status, scheduled_at);
create index activities_entity_idx on public.activities(entity_type, entity_id, created_at desc);
create index notifications_user_idx on public.notifications(user_id, is_read, created_at desc);

create or replace function public.can_manage_crm(target_agent uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.is_staff() and (target_agent is null or target_agent = auth.uid()))
$$;

alter table public.customers enable row level security; alter table public.leads enable row level security;
alter table public.follow_ups enable row level security; alter table public.site_visits enable row level security;
alter table public.activities enable row level security; alter table public.notifications enable row level security;

create policy customers_staff_select on public.customers for select to authenticated using (public.is_admin() or assigned_agent_id = auth.uid() or created_by = auth.uid());
create policy customers_staff_insert on public.customers for insert to authenticated with check (public.is_staff() and (public.is_admin() or created_by = auth.uid()));
create policy customers_staff_update on public.customers for update to authenticated using (public.is_admin() or assigned_agent_id = auth.uid() or created_by = auth.uid()) with check (public.is_admin() or assigned_agent_id = auth.uid() or created_by = auth.uid());
create policy leads_staff_select on public.leads for select to authenticated using (public.is_admin() or assigned_agent_id = auth.uid() or created_by = auth.uid());
create policy leads_staff_insert on public.leads for insert to authenticated with check (public.is_staff() and (public.is_admin() or created_by = auth.uid()));
create policy leads_staff_update on public.leads for update to authenticated using (public.is_admin() or assigned_agent_id = auth.uid() or created_by = auth.uid()) with check (public.is_admin() or assigned_agent_id = auth.uid() or created_by = auth.uid());
create policy followups_staff_all on public.follow_ups for all to authenticated using (public.is_admin() or assigned_agent_id = auth.uid() or created_by = auth.uid()) with check (public.is_admin() or assigned_agent_id = auth.uid() or created_by = auth.uid());
create policy visits_staff_all on public.site_visits for all to authenticated using (public.is_admin() or agent_id = auth.uid() or created_by = auth.uid()) with check (public.is_admin() or agent_id = auth.uid() or created_by = auth.uid());
create policy activities_staff_select on public.activities for select to authenticated using (public.is_admin() or user_id = auth.uid());
create policy activities_staff_insert on public.activities for insert to authenticated with check (public.is_staff() and user_id = auth.uid());
create policy notifications_own_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.create_public_enquiry_lead(
  p_property_id uuid, p_name text, p_email text, p_phone text, p_message text
) returns public.leads language plpgsql security definer set search_path = public as $$
declare customer_row public.customers; lead_row public.leads; agent_id uuid;
begin
  if p_property_id is not null and not exists (select 1 from properties where id = p_property_id and status = 'published') then raise exception 'Property is not available'; end if;
  select * into customer_row from customers where (p_email is not null and lower(email) = lower(p_email)) or (p_phone is not null and phone = p_phone) order by created_at limit 1;
  if customer_row.id is null then
    insert into customers(full_name,email,phone,source,customer_type,created_by) values (p_name,p_email,p_phone,'property_enquiry','buyer',null) returning * into customer_row;
  else
    update customers set full_name = coalesce(nullif(trim(p_name), ''), full_name), phone = coalesce(nullif(trim(p_phone), ''), phone), updated_at = now() where id = customer_row.id returning * into customer_row;
  end if;
  select id into agent_id from profiles where active and role in ('admin','agent') order by role = 'admin', created_at limit 1;
  insert into leads(customer_id,property_id,title,source,status,assigned_agent_id,notes) values (customer_row.id,p_property_id,'Property enquiry from '||customer_row.full_name,'property_enquiry','new',agent_id,p_message) returning * into lead_row;
  insert into activities(user_id,entity_type,entity_id,action,description,metadata) values (null,'lead',lead_row.id,'lead_created','New property enquiry received',jsonb_build_object('customer_id',customer_row.id,'property_id',p_property_id));
  if agent_id is not null then insert into notifications(user_id,title,message,type,entity_type,entity_id) values (agent_id,'New property enquiry',lead_row.title,'lead_assigned','lead',lead_row.id); end if;
  return lead_row;
end $$;
