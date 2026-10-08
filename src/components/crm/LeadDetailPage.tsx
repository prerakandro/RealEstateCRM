import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { BackLink } from '@/components/ui/BackLink'
import {
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  formatDateTime,
  optionalNumber,
  optionalText,
} from '@/lib/crm'
import { formatCurrency, getErrorMessage, titleCase } from '@/lib/utils'
import { listAgents } from '@/services/agents'
import { getCustomer } from '@/services/customers'
import { getLead, updateLead } from '@/services/leads'
import { listFollowUps } from '@/services/followUps'
import { listSiteVisits } from '@/services/siteVisits'
import {
  getPropertyTitles,
  listPropertyOptions,
  type NameMap,
  type Option,
} from '@/services/lookups'
import type {
  Customer,
  FollowUp,
  Lead,
  LeadPriority,
  LeadSource,
  LeadStatus,
  Profile,
  SiteVisit,
} from '@/types/domain'
import { FollowUpForm, SiteVisitForm } from './forms'
import { FollowUpTable, SiteVisitTable } from './tables'
import {
  AgentOptions,
  NotesPanel,
  Panel,
  SelectOptions,
  TimelinePanel,
} from './ui'

export function LeadDetailPage({ profile }: { profile: Profile }) {
  const { id = '' } = useParams()
  const [lead, setLead] = useState<Lead | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [agents, setAgents] = useState<Profile[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [visits, setVisits] = useState<SiteVisit[]>([])
  const [properties, setProperties] = useState<NameMap>({})
  const [error, setError] = useState('')
  const [form, setForm] = useState<'' | 'follow-up' | 'visit' | 'edit'>('')
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey((key) => key + 1)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getLead(id),
      listAgents(),
      listFollowUps({ leadId: id }),
      listSiteVisits({ leadId: id }),
    ])
      .then(async ([leadRow, team, tasks, visitRows]) => {
        const [customerRow, titles] = await Promise.all([
          getCustomer(leadRow.customer_id).catch(() => null),
          getPropertyTitles([
            leadRow.property_id,
            ...visitRows.map((visit) => visit.property_id),
          ]),
        ])
        if (cancelled) return
        setLead(leadRow)
        setCustomer(customerRow)
        setAgents(team)
        setFollowUps(tasks)
        setVisits(visitRows)
        setProperties(titles)
        setError('')
      })
      .catch((e) => !cancelled && setError(getErrorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [id, refreshKey])

  if (!lead)
    return (
      <>
        <BackLink fallback="/crm/leads" fallbackLabel="All leads" />
        <div className="loading">{error || 'Loading lead…'}</div>
      </>
    )
  const current = lead
  const isAdmin = profile.role === 'admin'
  const agentNames: NameMap = Object.fromEntries(
    agents.map((agent) => [agent.id, agent.full_name]),
  )
  const change = (input: Partial<Lead>) =>
    updateLead(current.id, input)
      .then(refresh)
      .catch((e) => setError(getErrorMessage(e)))
  const closeForm = () => setForm('')
  const saved = () => {
    setForm('')
    refresh()
  }

  return (
    <>
      <BackLink fallback="/crm/leads" fallbackLabel="All leads" />
      <div className="crm-head">
        <div>
          <p className="eyebrow">Lead</p>
          <h1>{current.title}</h1>
        </div>
        <div className="action-row">
          <select
            aria-label="Stage"
            value={current.status}
            onChange={(e) => change({ status: e.target.value as LeadStatus })}
          >
            <SelectOptions values={LEAD_STATUSES} />
          </select>
          <Button
            variant="secondary"
            onClick={() => setForm(form === 'edit' ? '' : 'edit')}
          >
            Edit details
          </Button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {form === 'edit' && (
        <LeadDetailsForm
          lead={current}
          onCancel={closeForm}
          onSave={(input) => change(input).then(closeForm)}
        />
      )}
      <div className="detail-layout">
        <div className="detail-main">
          <Panel title="Overview">
            <dl className="facts-grid">
              <div>
                <dt>Customer</dt>
                <dd>
                  <Link to={`/crm/customers/${current.customer_id}`}>
                    {customer?.full_name ?? 'Open customer'}
                  </Link>
                  {customer && (
                    <small>
                      {[customer.phone, customer.email]
                        .filter(Boolean)
                        .join(' · ') || 'No contact details'}
                    </small>
                  )}
                </dd>
              </div>
              <div>
                <dt>Property</dt>
                <dd>
                  {current.property_id ? (
                    <Link to={`/crm/properties/${current.property_id}/edit`}>
                      {properties[current.property_id] ?? 'Open property'}
                    </Link>
                  ) : (
                    'Not linked'
                  )}
                </dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd>
                  <select
                    aria-label="Priority"
                    value={current.priority}
                    onChange={(e) =>
                      change({ priority: e.target.value as LeadPriority })
                    }
                  >
                    <SelectOptions values={LEAD_PRIORITIES} />
                  </select>
                </dd>
              </div>
              <div>
                <dt>Assigned to</dt>
                <dd>
                  {isAdmin ? (
                    <select
                      aria-label="Assigned to"
                      value={current.assigned_agent_id ?? ''}
                      onChange={(e) =>
                        change({ assigned_agent_id: e.target.value || null })
                      }
                    >
                      <AgentOptions agents={agents} any="Unassigned" />
                    </select>
                  ) : current.assigned_agent_id ? (
                    (agentNames[current.assigned_agent_id] ?? 'Teammate')
                  ) : (
                    'Unassigned'
                  )}
                </dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{titleCase(current.source)}</dd>
              </div>
              <div>
                <dt>Expected budget</dt>
                <dd>
                  {current.expected_budget != null
                    ? formatCurrency(current.expected_budget, 'INR')
                    : 'Not set'}
                </dd>
              </div>
              <div>
                <dt>Next follow-up</dt>
                <dd>{formatDateTime(current.next_follow_up_at)}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDateTime(current.created_at)}</dd>
              </div>
              <div>
                <dt>Contacted</dt>
                <dd>{formatDateTime(current.contacted_at)}</dd>
              </div>
              <div>
                <dt>Qualified</dt>
                <dd>{formatDateTime(current.qualified_at)}</dd>
              </div>
              <div>
                <dt>Converted</dt>
                <dd>{formatDateTime(current.converted_at)}</dd>
              </div>
            </dl>
            {current.notes && (
              <blockquote className="lead-message">{current.notes}</blockquote>
            )}
          </Panel>
          <Panel
            title="Follow-ups"
            action={
              <Button
                size="sm"
                onClick={() => setForm(form === 'follow-up' ? '' : 'follow-up')}
              >
                Add follow-up
              </Button>
            }
          >
            {form === 'follow-up' && (
              <FollowUpForm
                profile={profile}
                agents={agents}
                customerId={current.customer_id}
                leadId={current.id}
                onCancel={closeForm}
                onSaved={saved}
              />
            )}
            <FollowUpTable
              items={followUps}
              agents={agentNames}
              onChanged={refresh}
              onError={setError}
            />
          </Panel>
          <Panel
            title="Site visits"
            action={
              <Button
                size="sm"
                onClick={() => setForm(form === 'visit' ? '' : 'visit')}
              >
                Schedule visit
              </Button>
            }
          >
            {form === 'visit' && (
              <SiteVisitForm
                profile={profile}
                agents={agents}
                customerId={current.customer_id}
                leadId={current.id}
                propertyId={current.property_id}
                onCancel={closeForm}
                onSaved={saved}
              />
            )}
            <SiteVisitTable
              items={visits}
              properties={properties}
              agents={agentNames}
              onChanged={refresh}
              onError={setError}
            />
          </Panel>
        </div>
        <div className="detail-side">
          <NotesPanel
            customerId={current.customer_id}
            leadId={current.id}
            profile={profile}
          />
          <TimelinePanel
            target={{ leadId: current.id }}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </>
  )
}

function LeadDetailsForm({
  lead,
  onSave,
  onCancel,
}: {
  lead: Lead
  onSave: (input: Partial<Lead>) => void
  onCancel: () => void
}) {
  const [properties, setProperties] = useState<Option[]>([])
  useEffect(() => {
    listPropertyOptions()
      .then(setProperties)
      .catch(() => setProperties([]))
  }, [])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onSave({
      title: String(form.get('title')).trim(),
      property_id: String(form.get('property_id') || '') || null,
      source: String(form.get('source')) as LeadSource,
      expected_budget: optionalNumber(form.get('expected_budget')),
      notes: optionalText(form.get('notes')),
    })
  }
  return (
    <form className="crm-form" onSubmit={submit}>
      <h2>Edit lead</h2>
      <label>
        Lead title
        <input required name="title" minLength={3} defaultValue={lead.title} />
      </label>
      <div className="form-grid">
        <label>
          Property
          <select
            name="property_id"
            defaultValue={lead.property_id ?? ''}
            key={properties.length}
          >
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
          <select name="source" defaultValue={lead.source}>
            <SelectOptions values={LEAD_SOURCES} />
          </select>
        </label>
        <label>
          Expected budget
          <input
            name="expected_budget"
            type="number"
            min="0"
            step="1000"
            defaultValue={lead.expected_budget ?? ''}
          />
        </label>
      </div>
      <label>
        Notes / original message
        <textarea name="notes" defaultValue={lead.notes ?? ''} />
      </label>
      <div className="action-row">
        <Button type="submit">Save lead</Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
