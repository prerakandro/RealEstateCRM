-- Reconciles the hosted database with migrations 202609080001 and 202609140001.
-- The hosted CRM tables were created by hand (text columns instead of enums) and
-- were missing row level security, the CRM policies, the public-enquiry → lead
-- workflow function and supporting indexes. Everything here is idempotent and
-- additive: no table, column or row is dropped.

-- 1. Row level security on CRM tables (they were readable/writable by anon).
alter table public.customers enable row level security;
alter table public.leads enable row level security;
alter table public.follow_ups enable row level security;
alter table public.site_visits enable row level security;
alter table public.activities enable row level security;
alter table public.notifications enable row level security;

create or replace function public.can_manage_crm(target_agent uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.is_staff() and (target_agent is null or target_agent = auth.uid()))
$$;

drop policy if exists customers_staff_select on public.customers;
drop policy if exists customers_staff_insert on public.customers;
drop policy if exists customers_staff_update on public.customers;
drop policy if exists leads_staff_select on public.leads;
drop policy if exists leads_staff_insert on public.leads;
drop policy if exists leads_staff_update on public.leads;
drop policy if exists followups_staff_all on public.follow_ups;
drop policy if exists visits_staff_all on public.site_visits;
drop policy if exists activities_staff_select on public.activities;
drop policy if exists activities_staff_insert on public.activities;
drop policy if exists notifications_own_select on public.notifications;
drop policy if exists notifications_own_update on public.notifications;

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

-- Anonymous visitors never touch CRM tables directly (enquiries go through
-- create_public_enquiry_lead below), so remove the blanket grants as well.
revoke all on public.customers, public.leads, public.follow_ups, public.site_visits, public.activities, public.notifications from anon;

-- 2. Missing policy from 202609080001.
drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 3. Public enquiry → customer + lead + activity + notification workflow.
create or replace function public.create_public_enquiry_lead(
  p_property_id uuid, p_name text, p_email text, p_phone text, p_message text
) returns public.leads language plpgsql security definer set search_path = public as $$
declare customer_row public.customers; lead_row public.leads; agent_id uuid;
begin
  if p_property_id is not null and not exists (select 1 from properties where id = p_property_id and status = 'published') then raise exception 'Property is not available'; end if;
  select * into customer_row from customers where (p_email is not null and lower(email) = lower(p_email)) or (p_phone is not null and phone = p_phone) order by created_at limit 1;
  if customer_row.id is null then
    insert into customers(full_name,email,phone,source,customer_type,customer_status,created_by) values (p_name,p_email,p_phone,'property_enquiry','buyer','new',null) returning * into customer_row;
  else
    update customers set full_name = coalesce(nullif(trim(p_name), ''), full_name), phone = coalesce(nullif(trim(p_phone), ''), phone), updated_at = now() where id = customer_row.id returning * into customer_row;
  end if;
  select id into agent_id from profiles where active and role in ('admin','agent') order by role = 'admin', created_at limit 1;
  insert into leads(customer_id,property_id,title,source,status,assigned_agent_id,notes) values (customer_row.id,p_property_id,'Property enquiry from '||customer_row.full_name,'property_enquiry','new',agent_id,p_message) returning * into lead_row;
  insert into activities(user_id,entity_type,entity_id,action,description,metadata) values (null,'lead',lead_row.id,'lead_created','New property enquiry received',jsonb_build_object('customer_id',customer_row.id,'property_id',p_property_id));
  if agent_id is not null then insert into notifications(user_id,title,message,type,entity_type,entity_id) values (agent_id,'New property enquiry',lead_row.title,'lead_assigned','lead',lead_row.id); end if;
  return lead_row;
end $$;
grant execute on function public.create_public_enquiry_lead(uuid, text, text, text, text) to anon, authenticated;

-- 4. Defaults aligned with the app's status values.
alter table public.customers alter column customer_status set default 'new';

-- 5. Indexes from 202609140001.
create unique index if not exists customers_email_unique on public.customers(lower(email)) where email is not null;
create index if not exists customers_agent_idx on public.customers(assigned_agent_id, updated_at desc);
create index if not exists leads_agent_status_idx on public.leads(assigned_agent_id, status, priority, updated_at desc);
create index if not exists leads_customer_idx on public.leads(customer_id);
create index if not exists leads_property_idx on public.leads(property_id);
create index if not exists follow_ups_schedule_idx on public.follow_ups(assigned_agent_id, status, scheduled_at);
create index if not exists site_visits_schedule_idx on public.site_visits(agent_id, status, scheduled_at);
create index if not exists activities_entity_idx on public.activities(entity_type, entity_id, created_at desc);
create index if not exists notifications_user_idx on public.notifications(user_id, is_read, created_at desc);
