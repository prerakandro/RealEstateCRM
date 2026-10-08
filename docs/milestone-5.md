# Milestone 5: Advanced CRM & property management

> Scope: advanced lead and customer management, detailed customer and lead
> profiles, advanced search and filtering, improved lead pipeline, bulk record
> management, property-agent assignment, detailed follow-up and site visit
> history, and enhanced CRM workflows.

## What's new

### CRM

| Area           | What staff can do                                                                                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leads          | Table **or** Kanban board (`/crm/leads?view=board`, drag a card between stages). Search, stage, priority, source and (admins) agent filters, plus **More filters**: created date range, budget range, follow-up overdue / none. Create leads. |
| Lead detail    | `/crm/leads/:id`: overview, stage / priority / assignee editing, linked customer and property, follow-ups, site visits, notes and an activity timeline.                                                                                       |
| Customers      | Search by name, email, phone or location; status, type and agent filters; pagination; full create form with preferences and budget.                                                                                                           |
| Customer page  | `/crm/customers/:id`: edit profile, leads, **matching published properties** (from location, type, buy/rent, budget, bedrooms), follow-ups, visits, notes.                                                                                    |
| Follow-ups     | Create from anywhere. Overdue / Today / Upcoming / All views. Complete, mark missed, cancel or reopen.                                                                                                                                        |
| Site visits    | Create from anywhere. Upcoming / Past / All views, status changes and outcome recording.                                                                                                                                                      |
| Notifications  | "Open" jumps to the lead, customer or page the notification is about.                                                                                                                                                                         |
| Names, not ids | Every list shows customer names, property titles and agent names instead of UUIDs.                                                                                                                                                            |
| Dashboard      | Extra cards (due today, overdue, converted, drafts) that link to the filtered list.                                                                                                                                                           |

### Bulk record management

- Tick rows (or "select all on this page") on **Leads**, **Customers** and **Properties** to act on them together.
- Leads: move to stage, set priority, assign to an agent (admins).
- Customers: set status, set type, assign to an agent (admins).
- Properties: publish, archive, move to draft, assign the listing agent (admins).
- **Export CSV** on Leads and Customers: the selected rows, or everything matching the current filters (up to 1,000). Cells that look like spreadsheet formulas are neutralised.
- Every bulk change goes through the normal single-record update, so each record still gets its activity entry and triggers, and access rules apply row by row; the result says how many could not be changed.

### Property management

- Full listing form: summary, locality, PIN code, country, currency (INR default), parking, built-up area, plot size, year built, amenities.
- Admins choose the listing agent (this also fixes saving a property as an admin, which sent the string `"null"` as `agent_id`).
- Drag-and-drop gallery ordering and "make cover" in the image manager.
- Staff property list: search, status / type / sale-rent / agent filters (including **Unassigned**, for bulk agent assignment), pagination, thumbnails.
- Property editor sidebar shows the listing's **leads and site-visit history** (with outcomes).
- Bulk publish, archive and move-to-draft; duplicate a listing; restore an archived listing.
- Public property page shows the summary, parking, year built and amenities.

### Permissions

- **Self sign-ups are no longer staff.** New accounts are created inactive; admins get an "Account awaiting approval" notification and activate them in Agents. A pending user who signs in is told their account is waiting for approval.
- The very first account on an empty project becomes the admin (bootstrap).
- Invited users (invite-agent function) are activated automatically.
- Agents page is admin-only; admins can change roles there.
- Property images and storage objects can only be changed by the listing's agent, its creator or an admin (previously any staff member).

### Automation (database triggers)

- **Balanced assignment** of website enquiries: active agents first, fewest open leads, then least recently assigned. Repeat customers stay with their agent.
- Notifications when someone else assigns you a lead, follow-up or site visit.
- Scheduling a site visit moves a new / contacted / qualified lead to "site visit scheduled".
- `leads.next_follow_up_at` always equals the earliest pending follow-up.
- Assigning a lead gives an unassigned customer the same agent.

## Deploying

1. Apply the migration `supabase/migrations/202610080001_milestone_five_advanced_crm.sql`:

   ```bash
   npx supabase db push
   ```

2. Redeploy the invite function (it now activates invited users):

   ```bash
   npx supabase functions deploy invite-agent
   ```

3. Deploy the frontend as usual.

4. **Review existing accounts.** The migration does not change existing rows. Anyone who signed up before this release is still active. Open Agents and deactivate accounts you don't recognise.

The migration is additive (no tables, columns or rows are dropped) and keeps every existing function signature, so the chatbot and public enquiry flow keep working.

## Database changes

| Object                            | Change                                                                  |
| --------------------------------- | ----------------------------------------------------------------------- |
| `crm_notes`                       | New table (customer / lead notes) with RLS                              |
| `handle_new_user`                 | New accounts inactive; first account admin; admins notified             |
| `create_public_enquiry_lead`      | Balanced assignment; customer gets the agent; activity links the lead   |
| `next_lead_assignee`              | New, internal only (no client execute grant)                            |
| `can_edit_property(_path)`        | New ownership helpers used by image and storage policies                |
| Policies                          | Own-profile read, customers via assigned lead, related-activity read    |
| Triggers                          | Lead / follow-up / site-visit assignment, visit → stage, next follow-up |
| `properties.currency` / `country` | Defaults `INR` / `IN` for new rows                                      |

## Tests

`npm run test` covers the new helpers (`src/lib/crm.test.ts`, `src/lib/propertyForm.test.ts`), the leads page and board (`src/components/crm/LeadsPage.test.tsx`) and access control for pending accounts and admin-only pages (`src/App.access.test.tsx`). The SQL was syntax-checked with the Postgres parser but has not been run against a database in this repository; apply it to a staging project first.
