import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { BackLink } from '@/components/ui/BackLink'
import { PropertyCard } from '@/components/PropertyCard'
import {
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  LEAD_SOURCES,
  customerSearchFilters,
  hasMatchCriteria,
  optionalNumber,
  optionalText,
} from '@/lib/crm'
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils'
import { listAgents } from '@/services/agents'
import { getCustomer, updateCustomer } from '@/services/customers'
import { listLeads } from '@/services/leads'
import { listFollowUps } from '@/services/followUps'
import { listSiteVisits } from '@/services/siteVisits'
import { getPropertyTitles, type NameMap } from '@/services/lookups'
import { searchPublicProperties } from '@/services/properties'
import type {
  Customer,
  CustomerStatus,
  CustomerType,
  FollowUp,
  Lead,
  LeadSource,
  ListingType,
  Profile,
  PropertySearchItem,
  PropertyType,
  SiteVisit,
} from '@/types/domain'
import { LISTING_TYPES, PROPERTY_TYPES } from '@/types/domain'
import { FollowUpForm, LeadForm, SiteVisitForm } from './forms'
import { FollowUpTable, SiteVisitTable } from './tables'
import {
  AgentOptions,
  NotesPanel,
  Panel,
  Pill,
  SelectOptions,
  TimelinePanel,
} from './ui'

type FormName = '' | 'edit' | 'lead' | 'follow-up' | 'visit'

export function CustomerDetailPage({ profile }: { profile: Profile }) {
  const { id = '' } = useParams()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [agents, setAgents] = useState<Profile[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [visits, setVisits] = useState<SiteVisit[]>([])
  const [properties, setProperties] = useState<NameMap>({})
  const [matches, setMatches] = useState<PropertySearchItem[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormName>('')
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey((key) => key + 1)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getCustomer(id),
      listAgents(),
      listLeads({ customerId: id, page: 1, pageSize: 50 }),
      listFollowUps({ customerId: id }),
      listSiteVisits({ customerId: id }),
    ])
      .then(async ([row, team, leadResult, tasks, visitRows]) => {
        const [titles, matchResult] = await Promise.all([
          getPropertyTitles(visitRows.map((visit) => visit.property_id)),
          hasMatchCriteria(row)
            ? searchPublicProperties(customerSearchFilters(row))
                .then((result) => result.data)
                .catch(() => [])
            : Promise.resolve([]),
        ])
        if (cancelled) return
        setCustomer(row)
        setAgents(team)
        setLeads(leadResult.data)
        setFollowUps(tasks)
        setVisits(visitRows)
        setProperties(titles)
        setMatches(matchResult)
        setError('')
      })
      .catch((e) => !cancelled && setError(getErrorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [id, refreshKey])

  if (!customer)
    return (
      <>
        <BackLink fallback="/crm/customers" fallbackLabel="All customers" />
        <div className="loading">{error || 'Loading customer…'}</div>
      </>
    )
  const current = customer
  const agentNames: NameMap = Object.fromEntries(
    agents.map((agent) => [agent.id, agent.full_name]),
  )
  const closeForm = () => setForm('')
  const saved = () => {
    setForm('')
    refresh()
  }
  const toggle = (name: FormName) => setForm(form === name ? '' : name)
  const budget =
    current.budget_min != null || current.budget_max != null
      ? [current.budget_min, current.budget_max]
          .map((value) => (value != null ? formatCurrency(value, 'INR') : '…'))
          .join(' – ')
      : 'Not set'

  return (
    <>
      <BackLink fallback="/crm/customers" fallbackLabel="All customers" />
      <div className="crm-head">
        <div>
          <p className="eyebrow">Customer</p>
          <h1>{current.full_name}</h1>
        </div>
        <div className="action-row">
          <Button variant="secondary" onClick={() => toggle('edit')}>
            Edit profile
          </Button>
          <Button onClick={() => toggle('lead')}>New lead</Button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {form === 'edit' && (
        <CustomerForm
          customer={current}
          agents={agents}
          isAdmin={profile.role === 'admin'}
          onCancel={closeForm}
          onSave={(input) =>
            updateCustomer(current.id, input)
              .then(saved)
              .catch((e) => setError(getErrorMessage(e)))
          }
        />
      )}
      {form === 'lead' && (
        <LeadForm
          profile={profile}
          agents={agents}
          customerId={current.id}
          onCancel={closeForm}
          onSaved={saved}
        />
      )}
      <div className="detail-layout">
        <div className="detail-main">
          <Panel title="Profile">
            <dl className="facts-grid">
              <div>
                <dt>Contact</dt>
                <dd>
                  {current.phone || '—'}
                  <small>{current.email || 'No email'}</small>
                  {current.alternate_phone && (
                    <small>Alt: {current.alternate_phone}</small>
                  )}
                </dd>
              </div>
              <div>
                <dt>Type · status</dt>
                <dd>
                  <Pill value={current.customer_type} />{' '}
                  <Pill value={current.customer_status} />
                </dd>
              </div>
              <div>
                <dt>Assigned to</dt>
                <dd>
                  {current.assigned_agent_id
                    ? (agentNames[current.assigned_agent_id] ?? 'Teammate')
                    : 'Unassigned'}
                </dd>
              </div>
              <div>
                <dt>Looking for</dt>
                <dd>
                  {[
                    current.bedrooms_required != null &&
                      `${current.bedrooms_required}+ bed`,
                    current.preferred_property_type,
                    current.preferred_listing_type &&
                      (current.preferred_listing_type === 'rent'
                        ? 'to rent'
                        : 'to buy'),
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Not set'}
                  <small>{current.preferred_location || 'Any location'}</small>
                </dd>
              </div>
              <div>
                <dt>Budget</dt>
                <dd>{budget}</dd>
              </div>
              <div>
                <dt>Customer since</dt>
                <dd>{formatDate(current.created_at)}</dd>
              </div>
            </dl>
            {current.notes && (
              <blockquote className="lead-message">{current.notes}</blockquote>
            )}
          </Panel>
          <Panel title="Leads">
            <div className="table">
              <table>
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Stage</th>
                    <th>Priority</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <b>
                          <Link to={`/crm/leads/${lead.id}`}>{lead.title}</Link>
                        </b>
                      </td>
                      <td>
                        <Pill value={lead.status} />
                      </td>
                      <td>
                        <Pill value={lead.priority} />
                      </td>
                      <td>{formatDate(lead.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!leads.length && (
                <p className="table-empty">No leads for this customer yet.</p>
              )}
            </div>
          </Panel>
          <Panel
            title="Matching properties"
            action={<small>Published listings that fit the preferences</small>}
          >
            {!hasMatchCriteria(current) ? (
              <p className="table-empty">
                Add a location, type, budget or bedrooms in the profile to see
                matches.
              </p>
            ) : matches.length ? (
              <div className="match-grid">
                {matches.map((property) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    footer={
                      <Link
                        className="text-button"
                        to={`/crm/properties/${property.id}/edit`}
                      >
                        Open in workspace
                      </Link>
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="table-empty">
                No published listings match yet. Try widening the budget or
                location.
              </p>
            )}
          </Panel>
          <Panel
            title="Follow-ups"
            action={
              <Button size="sm" onClick={() => toggle('follow-up')}>
                Add follow-up
              </Button>
            }
          >
            {form === 'follow-up' && (
              <FollowUpForm
                profile={profile}
                agents={agents}
                customerId={current.id}
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
              <Button size="sm" onClick={() => toggle('visit')}>
                Schedule visit
              </Button>
            }
          >
            {form === 'visit' && (
              <SiteVisitForm
                profile={profile}
                agents={agents}
                customerId={current.id}
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
          <NotesPanel customerId={current.id} profile={profile} />
          <TimelinePanel
            target={{ customerId: current.id }}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </>
  )
}

export function CustomerForm({
  customer,
  agents,
  isAdmin,
  onSave,
  onCancel,
}: {
  customer?: Customer
  agents: Profile[]
  isAdmin: boolean
  onSave: (input: Partial<Customer> & { full_name: string }) => void
  onCancel: () => void
}) {
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const budgetMin = optionalNumber(form.get('budget_min'))
    const budgetMax = optionalNumber(form.get('budget_max'))
    if (budgetMin != null && budgetMax != null && budgetMax < budgetMin) {
      setError('Maximum budget must be at least the minimum budget.')
      return
    }
    const bedrooms = optionalNumber(form.get('bedrooms_required'))
    onSave({
      full_name: String(form.get('full_name')).trim(),
      email: optionalText(form.get('email')),
      phone: optionalText(form.get('phone')),
      alternate_phone: optionalText(form.get('alternate_phone')),
      source: String(form.get('source')) as LeadSource,
      customer_type: String(form.get('customer_type')) as CustomerType,
      customer_status: String(form.get('customer_status')) as CustomerStatus,
      preferred_location: optionalText(form.get('preferred_location')),
      preferred_property_type:
        (String(form.get('preferred_property_type') || '') as PropertyType) ||
        null,
      preferred_listing_type:
        (String(form.get('preferred_listing_type') || '') as ListingType) ||
        null,
      budget_min: budgetMin,
      budget_max: budgetMax,
      bedrooms_required: bedrooms === null ? null : Math.trunc(bedrooms),
      notes: optionalText(form.get('notes')),
      ...(isAdmin && {
        assigned_agent_id: String(form.get('assigned_agent_id') || '') || null,
      }),
    })
  }
  return (
    <form className="crm-form" onSubmit={submit}>
      <h2>{customer ? 'Edit customer' : 'New customer'}</h2>
      <div className="form-grid">
        <label>
          Full name
          <input
            required
            minLength={2}
            name="full_name"
            defaultValue={customer?.full_name}
          />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" defaultValue={customer?.phone ?? ''} />
        </label>
        <label>
          Email
          <input
            name="email"
            type="email"
            defaultValue={customer?.email ?? ''}
          />
        </label>
        <label>
          Alternate phone
          <input
            name="alternate_phone"
            type="tel"
            defaultValue={customer?.alternate_phone ?? ''}
          />
        </label>
        <label>
          Customer type
          <select
            name="customer_type"
            defaultValue={customer?.customer_type ?? 'buyer'}
          >
            <SelectOptions values={CUSTOMER_TYPES} />
          </select>
        </label>
        <label>
          Status
          <select
            name="customer_status"
            defaultValue={customer?.customer_status ?? 'new'}
          >
            <SelectOptions values={CUSTOMER_STATUSES} />
          </select>
        </label>
        <label>
          Source
          <select name="source" defaultValue={customer?.source ?? 'phone'}>
            <SelectOptions values={LEAD_SOURCES} />
          </select>
        </label>
        {isAdmin && (
          <label>
            Assigned to
            <select
              name="assigned_agent_id"
              defaultValue={customer?.assigned_agent_id ?? ''}
            >
              <AgentOptions agents={agents} any="Unassigned" />
            </select>
          </label>
        )}
        <label>
          Preferred location
          <input
            name="preferred_location"
            placeholder="City or locality"
            defaultValue={customer?.preferred_location ?? ''}
          />
        </label>
        <label>
          Property type
          <select
            name="preferred_property_type"
            defaultValue={customer?.preferred_property_type ?? ''}
          >
            <option value="">Any type</option>
            {PROPERTY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buy or rent
          <select
            name="preferred_listing_type"
            defaultValue={customer?.preferred_listing_type ?? ''}
          >
            <option value="">Either</option>
            {LISTING_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bedrooms needed
          <input
            name="bedrooms_required"
            type="number"
            min="0"
            defaultValue={customer?.bedrooms_required ?? ''}
          />
        </label>
        <label>
          Budget from (₹)
          <input
            name="budget_min"
            type="number"
            min="0"
            step="1000"
            defaultValue={customer?.budget_min ?? ''}
          />
        </label>
        <label>
          Budget up to (₹)
          <input
            name="budget_max"
            type="number"
            min="0"
            step="1000"
            defaultValue={customer?.budget_max ?? ''}
          />
        </label>
      </div>
      <label>
        Notes
        <textarea name="notes" defaultValue={customer?.notes ?? ''} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="action-row">
        <Button type="submit">
          {customer ? 'Save customer' : 'Create customer'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
