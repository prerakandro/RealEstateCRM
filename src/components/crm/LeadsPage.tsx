import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { LEAD_PRIORITIES, LEAD_SOURCES, LEAD_STATUSES } from '@/lib/crm'
import { formatCurrency, formatDate, getErrorMessage } from '@/lib/utils'
import { listAgents } from '@/services/agents'
import { listLeads, updateLead, type LeadFilters } from '@/services/leads'
import { bulkResultMessage, bulkUpdateLeads } from '@/services/bulk'
import { csvDate, downloadCsv, toCsv } from '@/lib/csv'
import {
  getCustomerNames,
  getPropertyTitles,
  type NameMap,
} from '@/services/lookups'
import type {
  Lead,
  LeadPriority,
  LeadSource,
  LeadStatus,
  Profile,
} from '@/types/domain'
import { LeadBoard } from './LeadBoard'
import { LeadForm } from './forms'
import {
  AgentOptions,
  BulkBar,
  BulkSelect,
  Pagination,
  Pill,
  SelectOptions,
} from './ui'
import { useSelection } from './useSelection'

const PAGE_SIZE = 25
const BOARD_LIMIT = 300
const EXPORT_LIMIT = 1000
const MORE_FILTERS = ['from', 'to', 'min', 'max', 'due']

/** Next calendar day, so a "to" date includes the whole day. */
const dayAfter = (date: string) => {
  const next = new Date(`${date}T00:00:00`)
  next.setDate(next.getDate() + 1)
  return next.toISOString()
}

/** List filters from the URL; the board ignores the stage filter and paging. */
function leadFiltersFrom(
  params: URLSearchParams,
  overrides: Partial<LeadFilters> = {},
): LeadFilters {
  const get = (key: string) => params.get(key) ?? ''
  const board = get('view') === 'board'
  return {
    status: board ? undefined : (get('status') as LeadStatus) || undefined,
    priority: (get('priority') as LeadPriority) || undefined,
    source: (get('source') as LeadSource) || undefined,
    assignedAgentId: get('agent') || undefined,
    query: get('q') || undefined,
    createdFrom: get('from')
      ? new Date(`${get('from')}T00:00:00`).toISOString()
      : undefined,
    createdTo: get('to') ? dayAfter(get('to')) : undefined,
    minBudget: get('min') ? Number(get('min')) : undefined,
    maxBudget: get('max') ? Number(get('max')) : undefined,
    followUp: (get('due') as LeadFilters['followUp']) || undefined,
    page: board ? 1 : Math.max(1, Number(get('page') || 1)),
    pageSize: board ? BOARD_LIMIT : PAGE_SIZE,
    ...overrides,
  }
}

export function LeadsPage({ profile }: { profile: Profile }) {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'board' ? 'board' : 'table'
  const status = params.get('status') ?? ''
  const priority = params.get('priority') ?? ''
  const source = params.get('source') ?? ''
  const agentId = params.get('agent') ?? ''
  const query = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page') || 1))
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const minBudget = params.get('min') ?? ''
  const maxBudget = params.get('max') ?? ''
  const due = params.get('due') ?? ''

  const [items, setItems] = useState<Lead[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [agents, setAgents] = useState<Profile[]>([])
  const [customers, setCustomers] = useState<NameMap>({})
  const [properties, setProperties] = useState<NameMap>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState(query)
  const [refreshKey, setRefreshKey] = useState(0)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [showMore, setShowMore] = useState(() =>
    MORE_FILTERS.some((key) => params.get(key)),
  )
  const selection = useSelection(
    view === 'table' ? items.map((item) => item.id) : [],
  )

  const isAdmin = profile.role === 'admin'
  const agentNames: NameMap = Object.fromEntries(
    agents.map((agent) => [agent.id, agent.full_name]),
  )

  const filterKey = params.toString()
  const filters = (overrides: Partial<LeadFilters> = {}) =>
    leadFiltersFrom(params, overrides)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      listLeads(leadFiltersFrom(new URLSearchParams(filterKey))),
      listAgents(),
    ])
      .then(async ([result, team]) => {
        const [customerNames, propertyTitles] = await Promise.all([
          getCustomerNames(result.data.map((lead) => lead.customer_id)),
          getPropertyTitles(result.data.map((lead) => lead.property_id)),
        ])
        if (cancelled) return
        setItems(result.data)
        setTotalPages(result.totalPages)
        setAgents(team)
        setCustomers(customerNames)
        setProperties(propertyTitles)
        setError('')
      })
      .catch((e) => !cancelled && setError(getErrorMessage(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [filterKey, refreshKey])

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  const move = (lead: Lead, next: LeadStatus) => {
    // Optimistic: move the card now, roll back if the update fails.
    setItems((current) =>
      current.map((item) =>
        item.id === lead.id ? { ...item, status: next } : item,
      ),
    )
    updateLead(lead.id, { status: next })
      .then(() => setRefreshKey((key) => key + 1))
      .catch((e) => {
        setError(getErrorMessage(e))
        setRefreshKey((key) => key + 1)
      })
  }

  function bulk(input: Partial<Lead>) {
    const ids = selection.selected
    setBusy(true)
    setNotice('')
    setError('')
    bulkUpdateLeads(ids, input)
      .then((failed) => {
        setNotice(bulkResultMessage(ids.length, failed))
        selection.clear()
        setRefreshKey((key) => key + 1)
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setBusy(false))
  }

  /** Selected rows, or every lead matching the filters when none are selected. */
  async function exportCsv() {
    setBusy(true)
    setError('')
    try {
      const rows = selection.selected.length
        ? items.filter((item) => selection.isSelected(item.id))
        : (await listLeads(filters({ page: 1, pageSize: EXPORT_LIMIT }))).data
      const [customerNames, propertyTitles] = await Promise.all([
        getCustomerNames(rows.map((lead) => lead.customer_id)),
        getPropertyTitles(rows.map((lead) => lead.property_id)),
      ])
      downloadCsv(
        `leads-${csvDate()}.csv`,
        toCsv(
          [
            'Lead',
            'Customer',
            'Property',
            'Stage',
            'Priority',
            'Source',
            'Expected budget',
            'Assigned to',
            'Next follow-up',
            'Created',
          ],
          rows.map((lead) => [
            lead.title,
            customerNames[lead.customer_id],
            lead.property_id ? propertyTitles[lead.property_id] : '',
            lead.status,
            lead.priority,
            lead.source,
            lead.expected_budget,
            lead.assigned_agent_id ? agentNames[lead.assigned_agent_id] : '',
            lead.next_follow_up_at,
            lead.created_at,
          ]),
        ),
      )
      setNotice(`Exported ${rows.length} lead${rows.length === 1 ? '' : 's'}.`)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const reassign = (lead: Lead, assignee: string) =>
    updateLead(lead.id, { assigned_agent_id: assignee || null })
      .then(() => setRefreshKey((key) => key + 1))
      .catch((e) => setError(getErrorMessage(e)))

  return (
    <>
      <div className="crm-head">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h1>Leads</h1>
        </div>
        <div className="action-row">
          <div className="segmented" role="group" aria-label="View">
            <button
              aria-pressed={view === 'table'}
              onClick={() => setParam('view', '')}
            >
              Table
            </button>
            <button
              aria-pressed={view === 'board'}
              onClick={() => setParam('view', 'board')}
            >
              Board
            </button>
          </div>
          <Button variant="secondary" loading={busy} onClick={exportCsv}>
            Export CSV
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Close' : 'New lead'}
          </Button>
        </div>
      </div>
      {showForm && (
        <LeadForm
          profile={profile}
          agents={agents}
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            setRefreshKey((key) => key + 1)
          }}
        />
      )}
      <form
        className="crm-filters"
        onSubmit={(event) => {
          event.preventDefault()
          setParam('q', search.trim())
        }}
      >
        <input
          aria-label="Search leads"
          placeholder="Search lead titles"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {view === 'table' && (
          <select
            aria-label="Stage"
            value={status}
            onChange={(e) => setParam('status', e.target.value)}
          >
            <SelectOptions values={LEAD_STATUSES} any="All stages" />
          </select>
        )}
        <select
          aria-label="Priority"
          value={priority}
          onChange={(e) => setParam('priority', e.target.value)}
        >
          <SelectOptions values={LEAD_PRIORITIES} any="Any priority" />
        </select>
        <select
          aria-label="Source"
          value={source}
          onChange={(e) => setParam('source', e.target.value)}
        >
          <SelectOptions values={LEAD_SOURCES} any="Any source" />
        </select>
        {isAdmin && (
          <select
            aria-label="Agent"
            value={agentId}
            onChange={(e) => setParam('agent', e.target.value)}
          >
            <AgentOptions agents={agents} any="All agents" />
          </select>
        )}
        <Button type="submit" variant="secondary">
          Search
        </Button>
        <button
          type="button"
          className="text-button"
          aria-expanded={showMore}
          onClick={() => setShowMore(!showMore)}
        >
          {showMore ? 'Fewer filters' : 'More filters'}
        </button>
      </form>
      {showMore && (
        <div className="crm-filters more-filters">
          <label>
            Created from
            <input
              type="date"
              value={from}
              onChange={(e) => setParam('from', e.target.value)}
            />
          </label>
          <label>
            Created to
            <input
              type="date"
              value={to}
              onChange={(e) => setParam('to', e.target.value)}
            />
          </label>
          <label>
            Budget from (₹)
            <input
              type="number"
              min="0"
              step="100000"
              key={minBudget}
              defaultValue={minBudget}
              onBlur={(e) => setParam('min', e.target.value)}
            />
          </label>
          <label>
            Budget up to (₹)
            <input
              type="number"
              min="0"
              step="100000"
              key={maxBudget}
              defaultValue={maxBudget}
              onBlur={(e) => setParam('max', e.target.value)}
            />
          </label>
          <label>
            Follow-up
            <select
              value={due}
              onChange={(e) => setParam('due', e.target.value)}
            >
              <option value="">Any</option>
              <option value="overdue">Overdue</option>
              <option value="none">None scheduled</option>
            </select>
          </label>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              const next = new URLSearchParams(params)
              MORE_FILTERS.forEach((key) => next.delete(key))
              next.delete('page')
              setParams(next)
            }}
          >
            Reset
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice-inline">{notice}</p>}
      <BulkBar count={selection.selected.length} onClear={selection.clear}>
        <BulkSelect
          label="Move to stage"
          disabled={busy}
          onPick={(value) => bulk({ status: value as LeadStatus })}
        >
          <SelectOptions values={LEAD_STATUSES} />
        </BulkSelect>
        <BulkSelect
          label="Set priority"
          disabled={busy}
          onPick={(value) => bulk({ priority: value as LeadPriority })}
        >
          <SelectOptions values={LEAD_PRIORITIES} />
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
      {loading ? (
        <div className="loading">Loading leads…</div>
      ) : view === 'board' ? (
        <LeadBoard
          leads={items}
          customers={customers}
          agents={agentNames}
          onMove={move}
        />
      ) : (
        <>
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all leads on this page"
                      checked={selection.allSelected}
                      onChange={selection.toggleAll}
                    />
                  </th>
                  <th>Lead</th>
                  <th>Stage</th>
                  <th>Priority</th>
                  <th>Assigned</th>
                  <th>Next follow-up</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.title}`}
                        checked={selection.isSelected(item.id)}
                        onChange={() => selection.toggle(item.id)}
                      />
                    </td>
                    <td>
                      <b>
                        <Link to={`/crm/leads/${item.id}`}>{item.title}</Link>
                      </b>
                      <small>
                        <Link to={`/crm/customers/${item.customer_id}`}>
                          {customers[item.customer_id] ?? 'Customer'}
                        </Link>
                        {item.property_id && properties[item.property_id]
                          ? ` · ${properties[item.property_id]}`
                          : ''}
                        {item.expected_budget != null
                          ? ` · ${formatCurrency(item.expected_budget, 'INR')}`
                          : ''}
                      </small>
                    </td>
                    <td>
                      <select
                        aria-label={`Stage for ${item.title}`}
                        value={item.status}
                        onChange={(e) =>
                          move(item, e.target.value as LeadStatus)
                        }
                      >
                        <SelectOptions values={LEAD_STATUSES} />
                      </select>
                    </td>
                    <td>
                      <Pill value={item.priority} />
                    </td>
                    <td>
                      {isAdmin ? (
                        <select
                          aria-label={`Assignee for ${item.title}`}
                          value={item.assigned_agent_id ?? ''}
                          onChange={(e) => reassign(item, e.target.value)}
                        >
                          <AgentOptions agents={agents} any="Unassigned" />
                        </select>
                      ) : item.assigned_agent_id === profile.id ? (
                        'You'
                      ) : item.assigned_agent_id ? (
                        (agentNames[item.assigned_agent_id] ?? 'Teammate')
                      ) : (
                        'Unassigned'
                      )}
                    </td>
                    <td>{formatDate(item.next_follow_up_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && (
              <p className="table-empty">No leads match this view.</p>
            )}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={(next) => setParam('page', String(next))}
          />
        </>
      )}
    </>
  )
}
