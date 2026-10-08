-- Milestone 5: advanced CRM & property management.
-- Additive and re-runnable: no table, column or row is dropped or rewritten.
-- Existing function signatures are kept so earlier frontends keep working.

-- 1. Staff approval --------------------------------------------------------
-- Self sign-ups used to become active agents, which made every stranger who
-- registered "staff" (is_staff() only checks profiles.active). New accounts are
-- now inactive until an admin activates them. The very first account on an
-- empty project becomes the admin so a fresh install can be bootstrapped.
-- Invited users are activated by the invite-agent Edge Function.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  is_first boolean := not exists (select 1 from profiles);
  display_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));
begin
  insert into profiles (id, full_name, email, role, active)
  values (
    new.id,
    display_name,
    new.email,
    case when is_first then 'admin'::profile_role else 'agent'::profile_role end,
    is_first
  )
  on conflict (id) do nothing;

  -- The metadata flag only suppresses this notice for invites; it never grants access.
  if not is_first and coalesce(new.raw_user_meta_data ->> 'invited_by_admin', '') <> 'true' then
    insert into notifications (user_id, title, message, type, entity_type, entity_id)
    select p.id, 'Account awaiting approval',
           display_name || ' (' || new.email || ') signed up and needs approval in Agents.',
           'account_pending', 'profile', new.id
    from profiles p
    where p.role = 'admin' and p.active and p.id <> new.id;
  end if;
  return new;
end;
$$;

-- Inactive users must still be able to read their own profile so the app can
-- tell them their account is awaiting approval.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

-- 2. Property ownership for images ------------------------------------------
-- Any staff member could previously change or delete images on any listing.
create or replace function public.can_edit_property(p_property_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() and exists (
    select 1 from properties
    where id = p_property_id and (public.is_admin() or agent_id = auth.uid() or created_by = auth.uid())
  )
$$;

create or replace function public.can_edit_property_path(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return public.can_edit_property(split_part(p_name, '/', 1)::uuid);
exception when invalid_text_representation then
  return false;
end;
$$;

drop policy if exists "staff manage images" on public.property_images;
drop policy if exists "owners manage images" on public.property_images;
create policy "owners manage images" on public.property_images
  for all to authenticated
  using (public.can_edit_property(property_id))
  with check (public.can_edit_property(property_id));

drop policy if exists "staff upload property images" on storage.objects;
drop policy if exists "staff delete property images" on storage.objects;
drop policy if exists "owners upload property images" on storage.objects;
drop policy if exists "owners delete property images" on storage.objects;
create policy "owners upload property images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'property-images' and public.can_edit_property_path(name));
create policy "owners delete property images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'property-images' and public.can_edit_property_path(name));

-- 3. Market defaults (new rows only; existing listings keep their values) ----
alter table public.properties alter column currency set default 'INR';
alter table public.properties alter column country set default 'IN';

-- 4. CRM visibility ----------------------------------------------------------
-- An agent assigned to a lead can open that lead's customer.
drop policy if exists customers_via_lead_select on public.customers;
create policy customers_via_lead_select on public.customers
  for select to authenticated
  using (public.is_staff() and exists (
    select 1 from leads l where l.customer_id = customers.id and l.assigned_agent_id = auth.uid()
  ));

-- Activity timelines: staff can read events about records they can see. The
-- subqueries run under the caller's own RLS, so visibility is inherited.
drop policy if exists activities_related_select on public.activities;
create policy activities_related_select on public.activities
  for select to authenticated
  using (public.is_staff() and (
    (entity_type = 'lead' and exists (select 1 from leads l where l.id = entity_id))
    or (entity_type = 'customer' and exists (select 1 from customers c where c.id = entity_id))
    or (entity_type = 'follow_up' and exists (select 1 from follow_ups f where f.id = entity_id))
    or (entity_type = 'site_visit' and exists (select 1 from site_visits v where v.id = entity_id))
  ));

-- 5. Notes on customers and leads -------------------------------------------
create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 5000),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists crm_notes_customer_idx on public.crm_notes(customer_id, created_at desc);
create index if not exists crm_notes_lead_idx on public.crm_notes(lead_id, created_at desc);
alter table public.crm_notes enable row level security;

drop policy if exists crm_notes_select on public.crm_notes;
drop policy if exists crm_notes_insert on public.crm_notes;
drop policy if exists crm_notes_delete on public.crm_notes;
create policy crm_notes_select on public.crm_notes
  for select to authenticated
  using (public.is_staff() and (
    exists (select 1 from customers c where c.id = customer_id)
    or (lead_id is not null and exists (select 1 from leads l where l.id = lead_id))
  ));
create policy crm_notes_insert on public.crm_notes
  for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid() and (
    exists (select 1 from customers c where c.id = customer_id)
    or (lead_id is not null and exists (select 1 from leads l where l.id = lead_id))
  ));
create policy crm_notes_delete on public.crm_notes
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

revoke all on public.crm_notes from anon;
grant select, insert, delete on public.crm_notes to authenticated;

-- 6. Balanced lead assignment ------------------------------------------------
-- Active agents first (admins only when no agent is active), then whoever has
-- the fewest open leads, then whoever was assigned a lead least recently.
create or replace function public.next_lead_assignee() returns uuid
language sql stable security definer set search_path = public as $$
  select p.id
  from profiles p
  where p.active
  order by
    (p.role = 'agent') desc,
    (select count(*) from leads l
      where l.assigned_agent_id = p.id and l.status not in ('converted', 'lost', 'closed')) asc,
    (select max(l.created_at) from leads l where l.assigned_agent_id = p.id) asc nulls first,
    p.created_at asc
  limit 1
$$;
revoke execute on function public.next_lead_assignee() from public, anon, authenticated;

create or replace function public.create_public_enquiry_lead(
  p_property_id uuid, p_name text, p_email text, p_phone text, p_message text
) returns public.leads language plpgsql security definer set search_path = public as $$
declare customer_row public.customers; lead_row public.leads; agent_id uuid;
begin
  if p_property_id is not null and not exists (select 1 from properties where id = p_property_id and status = 'published') then raise exception 'Property is not available'; end if;
  select * into customer_row from customers where (p_email is not null and lower(email) = lower(p_email)) or (p_phone is not null and phone = p_phone) order by created_at limit 1;
  agent_id := coalesce(customer_row.assigned_agent_id, public.next_lead_assignee());
  if customer_row.id is null then
    insert into customers(full_name,email,phone,source,customer_type,customer_status,assigned_agent_id,created_by) values (p_name,p_email,p_phone,'property_enquiry','buyer','new',agent_id,null) returning * into customer_row;
  else
    update customers set full_name = coalesce(nullif(trim(p_name), ''), full_name), phone = coalesce(nullif(trim(p_phone), ''), phone), assigned_agent_id = coalesce(assigned_agent_id, agent_id), updated_at = now() where id = customer_row.id returning * into customer_row;
  end if;
  insert into leads(customer_id,property_id,title,source,status,assigned_agent_id,notes) values (customer_row.id,p_property_id,'Property enquiry from '||customer_row.full_name,'property_enquiry','new',agent_id,p_message) returning * into lead_row;
  insert into activities(user_id,entity_type,entity_id,action,description,metadata) values (null,'lead',lead_row.id,'lead_created','New property enquiry received',jsonb_build_object('customer_id',customer_row.id,'property_id',p_property_id,'lead_id',lead_row.id));
  if agent_id is not null then insert into notifications(user_id,title,message,type,entity_type,entity_id) values (agent_id,'New property enquiry',lead_row.title,'lead_assigned','lead',lead_row.id); end if;
  return lead_row;
end $$;
grant execute on function public.create_public_enquiry_lead(uuid, text, text, text, text) to anon, authenticated;

-- 7. Workflow triggers --------------------------------------------------------
-- Notify a staff member when someone else assigns them a lead, and give an
-- unassigned customer the same agent as their lead. Public enquiry leads
-- (created_by is null) are already handled inside create_public_enquiry_lead.
create or replace function public.on_lead_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_agent_id is null or auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' and new.created_by is null then return new; end if;
  if tg_op = 'UPDATE' and new.assigned_agent_id is not distinct from old.assigned_agent_id then return new; end if;
  if new.assigned_agent_id <> auth.uid() then
    insert into notifications (user_id, title, message, type, entity_type, entity_id)
    values (new.assigned_agent_id, 'Lead assigned to you', new.title, 'lead_assigned', 'lead', new.id);
  end if;
  update customers set assigned_agent_id = new.assigned_agent_id, updated_at = now()
  where id = new.customer_id and assigned_agent_id is null;
  return new;
end;
$$;
drop trigger if exists leads_assignment on public.leads;
create trigger leads_assignment
  after insert or update of assigned_agent_id on public.leads
  for each row execute function public.on_lead_assignment();

create or replace function public.on_follow_up_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_agent_id is null or auth.uid() is null or new.assigned_agent_id = auth.uid() then return new; end if;
  if tg_op = 'UPDATE' and new.assigned_agent_id is not distinct from old.assigned_agent_id then return new; end if;
  insert into notifications (user_id, title, message, type, entity_type, entity_id)
  values (new.assigned_agent_id, 'Follow-up assigned to you', new.title, 'follow_up_assigned', 'follow_up', new.id);
  return new;
end;
$$;
drop trigger if exists follow_ups_assignment on public.follow_ups;
create trigger follow_ups_assignment
  after insert or update of assigned_agent_id on public.follow_ups
  for each row execute function public.on_follow_up_assignment();

create or replace function public.on_site_visit_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Scheduling a visit moves an early-stage lead to "site visit scheduled".
  if tg_op = 'INSERT' and new.lead_id is not null then
    update leads set status = 'site_visit_scheduled', updated_at = now()
    where id = new.lead_id and status in ('new', 'contacted', 'qualified');
  end if;
  if new.agent_id is not null and auth.uid() is not null and new.agent_id <> auth.uid()
     and (tg_op = 'INSERT' or new.agent_id is distinct from old.agent_id) then
    insert into notifications (user_id, title, message, type, entity_type, entity_id)
    values (new.agent_id, 'Site visit assigned to you', 'Visit on ' || to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI'), 'site_visit_assigned', 'site_visit', new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists site_visits_change on public.site_visits;
create trigger site_visits_change
  after insert or update of agent_id on public.site_visits
  for each row execute function public.on_site_visit_change();

-- Keep leads.next_follow_up_at equal to the earliest pending follow-up.
create or replace function public.sync_lead_next_follow_up() returns trigger
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  foreach target in array array_remove(array[
    case when tg_op <> 'DELETE' then new.lead_id end,
    case when tg_op <> 'INSERT' then old.lead_id end
  ], null) loop
    update leads set next_follow_up_at = (
      select min(f.scheduled_at) from follow_ups f where f.lead_id = target and f.status = 'pending'
    ) where id = target;
  end loop;
  return null;
end;
$$;
drop trigger if exists follow_ups_sync_lead on public.follow_ups;
create trigger follow_ups_sync_lead
  after insert or update of status, scheduled_at, lead_id or delete on public.follow_ups
  for each row execute function public.sync_lead_next_follow_up();

-- 8. Indexes for the new filters and timelines --------------------------------
create index if not exists follow_ups_lead_idx on public.follow_ups(lead_id, status, scheduled_at);
create index if not exists follow_ups_customer_idx on public.follow_ups(customer_id, scheduled_at);
create index if not exists site_visits_lead_idx on public.site_visits(lead_id, scheduled_at);
create index if not exists site_visits_customer_idx on public.site_visits(customer_id, scheduled_at);
create index if not exists activities_lead_meta_idx on public.activities((metadata ->> 'lead_id'), created_at desc);
create index if not exists properties_staff_idx on public.properties(status, property_type, agent_id, updated_at desc);
