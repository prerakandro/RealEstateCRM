import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import {
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  FOLLOW_UP_STATUSES,
  SITE_VISIT_STATUSES,
  notificationLink,
} from '@/lib/crm'
import { getErrorMessage, formatDate, titleCase } from '@/lib/utils'
import { listAgents } from '@/services/agents'
import { createCustomer, listCustomers } from '@/services/customers'
import { bulkResultMessage, bulkUpdateCustomers } from '@/services/bulk'
import { csvDate, downloadCsv, toCsv } from '@/lib/csv'
import { listFollowUps, type FollowUpFilters } from '@/services/followUps'
import { listSiteVisits, type SiteVisitFilters } from '@/services/siteVisits'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notifications'
import {
  getCustomerNames,
  getPropertyTitles,
  type NameMap,
} from '@/services/lookups'
import type {
  Customer,
  CustomerStatus,
  CustomerType,
  Profile,
  FollowUp,
  FollowUpStatus,
  SiteVisit,
  SiteVisitStatus,
  Notification,
} from '@/types/domain'
import { CustomerForm } from './crm/CustomerDetailPage'
import { FollowUpForm, SiteVisitForm } from './crm/forms'
import { FollowUpTable, SiteVisitTable } from './crm/tables'
import {
  AgentOptions,
  BulkBar,
  BulkSelect,
  Pagination,
  Pill,
  SelectOptions,
} from './crm/ui'
import { useSelection } from './crm/useSelection'

export { LeadsPage } from './crm/LeadsPage'

const PAGE_SIZE = 25

function useParam() {
  const [params, setParams] = useSearchParams()
  const get = (key: string) => params.get(key) ?? ''
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }
  return { get, set, page: Math.max(1, Number(params.get('page') || 1)) }
}

const agentMap = (agents: Profile[]): NameMap =>
  Object.fromEntries(agents.map((agent) => [agent.id, agent.full_name]))

const customerFiltersFrom = (
  status: string,
  type: string,
  agentId: string,
  query: string,
) => ({
  query: query || undefined,
  status: (status as CustomerStatus) || undefined,
  type: (type as CustomerType) || undefined,
  assignedAgentId: agentId || undefined,
})

export function CustomersPage({ profile }: { profile: Profile }) {
  const param = useParam()
  const status = param.get('status')
  const type = param.get('type')
  const agentId = param.get('agent')
  const query = param.get('q')
  const [items, setItems] = useState<Customer[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [agents, setAgents] = useState<Profile[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState(query)
  const [showForm, setShowForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const isAdmin = profile.role === 'admin'
  const names = agentMap(agents)
  const selection = useSelection(items.map((item) => item.id))
  const customerFilters = () =>
    customerFiltersFrom(status, type, agentId, query)

  function bulk(input: Partial<Customer>) {
    const ids = selection.selected
    setBusy(true)
    setNotice('')
    setError('')
    bulkUpdateCustomers(ids, input)
      .then((failed) => {
        setNotice(bulkResultMessage(ids.length, failed))
        selection.clear()
        setRefreshKey((key) => key + 1)
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setBusy(false))
  }

  /** Selected rows, or every customer matching the filters. */
  async function exportCsv() {
    setBusy(true)
    setError('')
    try {
      const rows = selection.selected.length
        ? items.filter((item) => selection.isSelected(item.id))
        : (
            await listCustomers({
              ...customerFilters(),
              page: 1,
              pageSize: 1000,
            })
          ).data
      downloadCsv(
        `customers-${csvDate()}.csv`,
        toCsv(
          [
            'Name',
            'Phone',
            'Email',
            'Type',
            'Status',
            'Source',
            'Preferred location',
            'Property type',
            'Buy or rent',
            'Budget from',
            'Budget up to',
            'Bedrooms',
            'Assigned to',
            'Created',
          ],
          rows.map((c) => [
            c.full_name,
            c.phone,
            c.email,
            c.customer_type,
            c.customer_status,
            c.source,
            c.preferred_location,
            c.preferred_property_type,
            c.preferred_listing_type,
            c.budget_min,
            c.budget_max,
            c.bedrooms_required,
            c.assigned_agent_id ? names[c.assigned_agent_id] : '',
            c.created_at,
          ]),
        ),
      )
      setNotice(
        `Exported ${rows.length} customer${rows.length === 1 ? '' : 's'}.`,
      )
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listCustomers({
        ...customerFiltersFrom(status, type, agentId, query),
        page: param.page,
        pageSize: PAGE_SIZE,
      }),
      listAgents(),
    ])
      .then(([result, team]) => {
        if (cancelled) return
        setItems(result.data)
        setTotalPages(result.totalPages)
        setAgents(team)
        setError('')
      })
      .catch((e) => !cancelled && setError(getErrorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [query, status, type, agentId, param.page, refreshKey])

  return (
    <>
      <div className="crm-head">
        <div>
          <p className="eyebrow">Relationship management</p>
          <h1>Customers</h1>
        </div>
        <div className="action-row">
          <Button variant="secondary" loading={busy} onClick={exportCsv}>
            Export CSV
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Close' : 'Add customer'}
          </Button>
        </div>
      </div>
      {showForm && (
        <CustomerForm
          agents={agents}
          isAdmin={isAdmin}
          onCancel={() => setShowForm(false)}
          onSave={(input) =>
            createCustomer({
              ...input,
              created_by: profile.id,
              // Agents own the customers they add; admins choose in the form.
              assigned_agent_id: isAdmin
                ? (input.assigned_agent_id ?? null)
                : profile.id,
            })
              .then(() => {
                setShowForm(false)
                setRefreshKey((key) => key + 1)
              })
              .catch((e) => setError(getErrorMessage(e)))
          }
        />
      )}
      <form
        className="crm-filters"
        onSubmit={(event) => {
          event.preventDefault()
          param.set('q', search.trim())
        }}
      >
        <input
          aria-label="Search customers"
          placeholder="Search name, email, phone or location"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => param.set('status', e.target.value)}
        >
          <SelectOptions values={CUSTOMER_STATUSES} any="Any status" />
        </select>
        <select
          aria-label="Type"
          value={type}
          onChange={(e) => param.set('type', e.target.value)}
        >
          <SelectOptions values={CUSTOMER_TYPES} any="Any type" />
        </select>
        {isAdmin && (
          <select
            aria-label="Agent"
            value={agentId}
            onChange={(e) => param.set('agent', e.target.value)}
          >
            <AgentOptions agents={agents} any="All agents" />
          </select>
        )}
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice-inline">{notice}</p>}
      <BulkBar count={selection.selected.length} onClear={selection.clear}>
        <BulkSelect
          label="Set status"
          disabled={busy}
          onPick={(value) => bulk({ customer_status: value as CustomerStatus })}
        >
          <SelectOptions values={CUSTOMER_STATUSES} />
        </BulkSelect>
        <BulkSelect
          label="Set type"
          disabled={busy}
          onPick={(value) => bulk({ customer_type: value as CustomerType })}
        >
          <SelectOptions values={CUSTOMER_TYPES} />
        </BulkSelect>
        {isAdmin && (
          <BulkSelect
            label="Assign to"
            disabled={busy}
            onPick={(value) =>
              bulk({ assigned_agent_id: value === 'none' ? null : value })
            }
          >
            <option value="none">Unassigned</option>
            <AgentOptions agents={agents.filter((agent) => agent.active)} />
          </BulkSelect>
        )}
        <Button
          size="sm"
          variant="secondary"
          loading={busy}
          onClick={exportCsv}
        >
          Export selected
        </Button>
      </BulkBar>
      <div className="table">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Select all customers on this page"
                  checked={selection.allSelected}
                  onChange={selection.toggleAll}
                />
              </th>
              <th>Customer</th>
              <th>Type</th>
              <th>Status</th>
              <th>Assigned</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.full_name}`}
                    checked={selection.isSelected(item.id)}
                    onChange={() => selection.toggle(item.id)}
                  />
                </td>
                <td>
                  <b>
                    <Link to={`/crm/customers/${item.id}`}>
                      {item.full_name}
                    </Link>
                  </b>
                  <small>
                    {item.phone || item.email || 'No contact details'}
                    {item.preferred_location
                      ? ` · ${item.preferred_location}`
                      : ''}
                  </small>
                </td>
                <td>{titleCase(item.customer_type)}</td>
                <td>
                  <Pill value={item.customer_status} />
                </td>
                <td>
                  {item.assigned_agent_id === profile.id
                    ? 'You'
                    : item.assigned_agent_id
                      ? (names[item.assigned_agent_id] ?? 'Teammate')
                      : 'Unassigned'}
                </td>
                <td>{formatDate(item.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <p className="table-empty">No customers found.</p>}
      </div>
      <Pagination
        page={param.page}
        totalPages={totalPages}
        onChange={(page) => param.set('page', String(page))}
      />
    </>
  )
}

/** Day boundaries in the viewer's timezone, as ISO strings. */
function dayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

const FOLLOW_UP_VIEWS = ['overdue', 'today', 'upcoming', 'all'] as const
type FollowUpView = (typeof FOLLOW_UP_VIEWS)[number]

export function FollowUpsPage({ profile }: { profile: Profile }) {
  const param = useParam()
  const view = (FOLLOW_UP_VIEWS as readonly string[]).includes(
    param.get('view'),
  )
    ? (param.get('view') as FollowUpView)
    : 'today'
  const status = param.get('status')
  const agentId = param.get('agent')
  const [items, setItems] = useState<FollowUp[]>([])
  const [agents, setAgents] = useState<Profile[]>([])
  const [customers, setCustomers] = useState<NameMap>({})
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey((key) => key + 1)

  useEffect(() => {
    let cancelled = false
    const { start, end } = dayRange()
    const filters: FollowUpFilters = {
      assignedAgentId: agentId || undefined,
      limit: 300,
      ...(view === 'overdue' && { overdue: true }),
      ...(view === 'today' && { status: 'pending', from: start, to: end }),
      ...(view === 'upcoming' && { status: 'pending', from: end }),
      ...(view === 'all' && {
        status: (status as FollowUpStatus) || undefined,
      }),
    }
    Promise.all([listFollowUps(filters), listAgents()])
      .then(async ([rows, team]) => {
        const names = await getCustomerNames(rows.map((row) => row.customer_id))
        if (cancelled) return
        setItems(rows)
        setAgents(team)
        setCustomers(names)
        setError('')
      })
      .catch((e) => !cancelled && setError(getErrorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [view, status, agentId, refreshKey])

  return (
    <>
      <div className="crm-head">
        <div>
          <p className="eyebrow">Next actions</p>
          <h1>Follow-ups</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Close' : 'New follow-up'}
        </Button>
      </div>
      {showForm && (
        <FollowUpForm
          profile={profile}
          agents={agents}
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            refresh()
          }}
        />
      )}
      <div className="crm-filters">
        <div className="segmented" role="group" aria-label="Show">
          {FOLLOW_UP_VIEWS.map((option) => (
            <button
              key={option}
              aria-pressed={view === option}
              onClick={() => param.set('view', option)}
            >
              {titleCase(option)}
            </button>
          ))}
        </div>
        {view === 'all' && (
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => param.set('status', e.target.value)}
          >
            <SelectOptions values={FOLLOW_UP_STATUSES} any="Any status" />
          </select>
        )}
        {profile.role === 'admin' && (
          <select
            aria-label="Agent"
            value={agentId}
            onChange={(e) => param.set('agent', e.target.value)}
          >
            <AgentOptions agents={agents} any="All agents" />
          </select>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <FollowUpTable
        items={items}
        agents={agentMap(agents)}
        customers={customers}
        onChanged={refresh}
        onError={setError}
        empty={
          view === 'overdue'
            ? 'Nothing overdue. Nice work.'
            : 'No follow-ups in this view.'
        }
      />
    </>
  )
}

const VISIT_VIEWS = ['upcoming', 'past', 'all'] as const
type VisitView = (typeof VISIT_VIEWS)[number]

export function SiteVisitsPage({ profile }: { profile: Profile }) {
  const param = useParam()
  const view = (VISIT_VIEWS as readonly string[]).includes(param.get('view'))
    ? (param.get('view') as VisitView)
    : 'upcoming'
  const status = param.get('status')
  const agentId = param.get('agent')
  const [items, setItems] = useState<SiteVisit[]>([])
  const [agents, setAgents] = useState<Profile[]>([])
  const [customers, setCustomers] = useState<NameMap>({})
  const [properties, setProperties] = useState<NameMap>({})
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey((key) => key + 1)

  useEffect(() => {
    let cancelled = false
    const now = new Date().toISOString()
    const filters: SiteVisitFilters = {
      agentId: agentId || undefined,
      status: (status as SiteVisitStatus) || undefined,
      limit: 300,
      ...(view === 'upcoming' && { from: now }),
      ...(view === 'past' && { to: now }),
    }
    Promise.all([listSiteVisits(filters), listAgents()])
      .then(async ([rows, team]) => {
        const [customerNames, titles] = await Promise.all([
          getCustomerNames(rows.map((row) => row.customer_id)),
          getPropertyTitles(rows.map((row) => row.property_id)),
        ])
        if (cancelled) return
        // Past visits read best newest-first.
        setItems(view === 'past' ? [...rows].reverse() : rows)
        setAgents(team)
        setCustomers(customerNames)
        setProperties(titles)
        setError('')
      })
      .catch((e) => !cancelled && setError(getErrorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [view, status, agentId, refreshKey])

  return (
    <>
      <div className="crm-head">
        <div>
          <p className="eyebrow">Appointments</p>
          <h1>Site visits</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Close' : 'Schedule visit'}
        </Button>
      </div>
      {showForm && (
        <SiteVisitForm
          profile={profile}
          agents={agents}
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            refresh()
          }}
        />
      )}
      <div className="crm-filters">
        <div className="segmented" role="group" aria-label="Show">
          {VISIT_VIEWS.map((option) => (
            <button
              key={option}
              aria-pressed={view === option}
              onClick={() => param.set('view', option)}
            >
              {titleCase(option)}
            </button>
          ))}
        </div>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => param.set('status', e.target.value)}
        >
          <SelectOptions values={SITE_VISIT_STATUSES} any="Any status" />
        </select>
        {profile.role === 'admin' && (
          <select
            aria-label="Agent"
            value={agentId}
            onChange={(e) => param.set('agent', e.target.value)}
          >
            <AgentOptions agents={agents} any="All agents" />
          </select>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <SiteVisitTable
        items={items}
        agents={agentMap(agents)}
        customers={customers}
        properties={properties}
        onChanged={refresh}
        onError={setError}
        empty="No site visits in this view."
      />
    </>
  )
}

export function NotificationsPage({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const [items, setItems] = useState<Notification[]>([]),
    [error, setError] = useState(''),
    [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey((key) => key + 1)
  useEffect(() => {
    listNotifications({ userId: profile.id, limit: 50 })
      .then(setItems)
      .catch((e) => setError(getErrorMessage(e)))
  }, [profile.id, refreshKey])
  function open(item: Notification) {
    const link = notificationLink(item)
    const read = item.is_read
      ? Promise.resolve()
      : markNotificationRead(item.id)
    read
      .then(() => (link ? navigate(link) : refresh()))
      .catch((e) => setError(getErrorMessage(e)))
  }
  return (
    <>
      <div className="crm-head">
        <div>
          <p className="eyebrow">Inbox</p>
          <h1>Notifications</h1>
        </div>
        <Button
          variant="secondary"
          onClick={() =>
            markAllNotificationsRead()
              .then(refresh)
              .catch((e) => setError(getErrorMessage(e)))
          }
        >
          Mark all read
        </Button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="notification-list">
        {items.map((item) => (
          <article
            className={item.is_read ? 'notification read' : 'notification'}
            key={item.id}
          >
            <div>
              <b>{item.title}</b>
              <p>{item.message}</p>
              <small>{formatDate(item.created_at)}</small>
            </div>
            <div className="row-actions">
              {notificationLink(item) && (
                <button className="text-button" onClick={() => open(item)}>
                  Open
                </button>
              )}
              {!item.is_read && (
                <button
                  className="text-button"
                  onClick={() =>
                    markNotificationRead(item.id)
                      .then(refresh)
                      .catch((e) => setError(getErrorMessage(e)))
                  }
                >
                  Mark read
                </button>
              )}
            </div>
          </article>
        ))}
        {!items.length && !error && (
          <p className="table-empty">You are all caught up.</p>
        )}
      </div>
    </>
  )
}
