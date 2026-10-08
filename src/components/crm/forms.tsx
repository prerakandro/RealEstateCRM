import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import {
  FOLLOW_UP_TYPES,
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  fromDateTimeLocal,
  optionalNumber,
  optionalText,
} from '@/lib/crm'
import { getErrorMessage } from '@/lib/utils'
import { createLead } from '@/services/leads'
import { createFollowUp } from '@/services/followUps'
import { createSiteVisit } from '@/services/siteVisits'
import { listPropertyOptions, type Option } from '@/services/lookups'
import type {
  FollowUpType,
  LeadPriority,
  LeadSource,
  Profile,
} from '@/types/domain'
import { AgentOptions, CustomerPicker, SelectOptions } from './ui'

interface FormProps {
  profile: Profile
  agents: Profile[]
  /** When set, the customer is fixed and no picker is shown. */
  customerId?: string
  leadId?: string
  onSaved: () => void
  onCancel: () => void
}

function usePropertyOptions() {
  const [options, setOptions] = useState<Option[]>([])
  useEffect(() => {
    listPropertyOptions()
      .then(setOptions)
      .catch(() => setOptions([]))
  }, [])
  return options
}

function useSubmit(onSaved: () => void) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const run = (work: () => Promise<unknown>) => {
    setSaving(true)
    setError('')
    work()
      .then(onSaved)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setSaving(false))
  }
  return { saving, error, run }
}

/** Admins pick the owner; agents always own what they create. */
function AssigneeField({
  profile,
  agents,
  name,
  label = 'Assigned to',
}: {
  profile: Profile
  agents: Profile[]
  name: string
  label?: string
}) {
  if (profile.role !== 'admin') return null
  return (
    <label>
      {label}
      <select name={name} defaultValue={profile.id}>
        <AgentOptions agents={agents.filter((agent) => agent.active)} />
      </select>
    </label>
  )
}

const assignee = (profile: Profile, form: FormData, name: string) =>
  profile.role === 'admin'
    ? String(form.get(name) || '') || profile.id
    : profile.id

export function LeadForm({
  profile,
  agents,
  customerId,
  onSaved,
  onCancel,
}: FormProps) {
  const properties = usePropertyOptions()
  const { saving, error, run } = useSubmit(onSaved)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    run(() =>
      createLead({
        title: String(form.get('title')).trim(),
        customer_id: customerId ?? String(form.get('customer_id')),
        property_id: String(form.get('property_id') || '') || null,
        source: String(form.get('source')) as LeadSource,
        priority: String(form.get('priority')) as LeadPriority,
        expected_budget: optionalNumber(form.get('expected_budget')),
        notes: optionalText(form.get('notes')),
        assigned_agent_id: assignee(profile, form, 'assigned_agent_id'),
        created_by: profile.id,
      }),
    )
  }
  return (
    <form className="crm-form" onSubmit={submit}>
      <h2>New lead</h2>
      {!customerId && (
        <label>
          Customer
          <CustomerPicker />
        </label>
      )}
      <label>
        Lead title
        <input
          required
          name="title"
          minLength={3}
          placeholder="e.g. 3 BHK purchase in Malviya Nagar"
        />
      </label>
      <div className="form-grid">
        <label>
          Property (optional)
          <select name="property_id">
            <option value="">No specific property</option>
            {properties.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Source
          <select name="source" defaultValue="phone">
            <SelectOptions values={LEAD_SOURCES} />
          </select>
        </label>
        <label>
          Priority
          <select name="priority" defaultValue="medium">
            <SelectOptions values={LEAD_PRIORITIES} />
          </select>
        </label>
        <label>
          Expected budget
          <input name="expected_budget" type="number" min="0" step="1000" />
        </label>
        <AssigneeField
          profile={profile}
          agents={agents}
          name="assigned_agent_id"
        />
      </div>
      <label>
        Notes
        <textarea name="notes" />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="action-row">
        <Button type="submit" loading={saving}>
          Create lead
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function FollowUpForm({
  profile,
  agents,
  customerId,
  leadId,
  onSaved,
  onCancel,
}: FormProps) {
  const { saving, error, run } = useSubmit(onSaved)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const scheduledAt = fromDateTimeLocal(String(form.get('scheduled_at')))
    if (!scheduledAt) return
    run(() =>
      createFollowUp({
        title: String(form.get('title')).trim(),
        customer_id: customerId ?? String(form.get('customer_id')),
        lead_id: leadId ?? null,
        follow_up_type: String(form.get('follow_up_type')) as FollowUpType,
        priority: String(form.get('priority')) as LeadPriority,
        scheduled_at: scheduledAt,
        notes: optionalText(form.get('notes')),
        assigned_agent_id: assignee(profile, form, 'assigned_agent_id'),
        created_by: profile.id,
      }),
    )
  }
  return (
    <form className="crm-form" onSubmit={submit}>
      <h2>Schedule follow-up</h2>
      {!customerId && (
        <label>
          Customer
          <CustomerPicker />
        </label>
      )}
      <label>
        What needs to happen
        <input
          required
          name="title"
          placeholder="e.g. Share brochure and price sheet"
        />
      </label>
      <div className="form-grid">
        <label>
          When
          <input required name="scheduled_at" type="datetime-local" />
        </label>
        <label>
          Type
          <select name="follow_up_type" defaultValue="call">
            <SelectOptions values={FOLLOW_UP_TYPES} />
          </select>
        </label>
        <label>
          Priority
          <select name="priority" defaultValue="medium">
            <SelectOptions values={LEAD_PRIORITIES} />
          </select>
        </label>
        <AssigneeField
          profile={profile}
          agents={agents}
          name="assigned_agent_id"
        />
      </div>
      <label>
        Notes
        <textarea name="notes" />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="action-row">
        <Button type="submit" loading={saving}>
          Schedule
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function SiteVisitForm({
  profile,
  agents,
  customerId,
  leadId,
  propertyId,
  onSaved,
  onCancel,
}: FormProps & { propertyId?: string | null }) {
  const properties = usePropertyOptions()
  const { saving, error, run } = useSubmit(onSaved)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const scheduledAt = fromDateTimeLocal(String(form.get('scheduled_at')))
    if (!scheduledAt) return
    run(() =>
      createSiteVisit({
        customer_id: customerId ?? String(form.get('customer_id')),
        lead_id: leadId ?? null,
        property_id: String(form.get('property_id')),
        scheduled_at: scheduledAt,
        notes: optionalText(form.get('notes')),
        agent_id: assignee(profile, form, 'agent_id'),
        created_by: profile.id,
      }),
    )
  }
  return (
    <form className="crm-form" onSubmit={submit}>
      <h2>Schedule site visit</h2>
      {!customerId && (
        <label>
          Customer
          <CustomerPicker />
        </label>
      )}
      <div className="form-grid">
        <label>
          Property
          <select
            required
            name="property_id"
            defaultValue={propertyId ?? ''}
            key={properties.length}
          >
            <option value="">Choose a property…</option>
            {properties.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          When
          <input required name="scheduled_at" type="datetime-local" />
        </label>
        <AssigneeField
          profile={profile}
          agents={agents}
          name="agent_id"
          label="Agent"
        />
      </div>
      <label>
        Notes
        <textarea
          name="notes"
          placeholder="Meeting point, keys, special requests…"
        />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="action-row">
        <Button type="submit" loading={saving}>
          Schedule visit
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
