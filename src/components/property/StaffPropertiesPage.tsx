import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Home } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { BackLink } from '@/components/ui/BackLink'
import { formatCurrency, getErrorMessage, titleCase } from '@/lib/utils'
import { readPropertyForm } from '@/lib/propertyForm'
import { listAgents } from '@/services/agents'
import {
  bulkChangeStatus,
  createProperty,
  duplicateProperty,
  listStaffProperties,
  type BulkPropertyAction,
  type StaffPropertyItem,
} from '@/services/properties'
import { getPublicImageUrl } from '@/services/storage'
import type {
  ListingType,
  Profile,
  PropertyStatus,
  PropertyType,
} from '@/types/domain'
import {
  LISTING_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
} from '@/types/domain'
import { AgentOptions, BulkSelect, Pagination } from '@/components/crm/ui'
import { bulkResultMessage, bulkUpdateProperties } from '@/services/bulk'
import { PropertyFields } from './PropertyFields'

const PAGE_SIZE = 20

export function StaffPropertiesPage({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const get = (key: string) => params.get(key) ?? ''
  const page = Math.max(1, Number(params.get('page') || 1))
  const [items, setItems] = useState<StaffPropertyItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [agents, setAgents] = useState<Profile[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState(get('q'))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const agentNames = Object.fromEntries(
    agents.map((agent) => [agent.id, agent.full_name]),
  )
  const filterKey = params.toString()

  useEffect(() => {
    let cancelled = false
    const filters = new URLSearchParams(filterKey)
    Promise.all([
      listStaffProperties({
        query: filters.get('q') || undefined,
        status: (filters.get('status') as PropertyStatus) || undefined,
        propertyType: (filters.get('type') as PropertyType) || undefined,
        listingType: (filters.get('listing') as ListingType) || undefined,
        agentId: filters.get('agent') || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
      listAgents(),
    ])
      .then(([result, team]) => {
        if (cancelled) return
        setItems(result.data)
        setTotal(result.total)
        setTotalPages(result.totalPages)
        setAgents(team)
        setSelected(new Set())
        setError('')
      })
      .catch((e) => !cancelled && setError(getErrorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [filterKey, page, refreshKey])

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function bulk(action: BulkPropertyAction) {
    const ids = [...selected]
    setBusy(true)
    setNotice('')
    setError('')
    bulkChangeStatus(ids, action)
      .then((failed) => {
        const done = ids.length - failed.length
        setNotice(
          `${done} listing${done === 1 ? '' : 's'} updated.` +
            (failed.length
              ? ` ${failed.length} could not be changed (you can only change listings you own).`
              : ''),
        )
        setRefreshKey((key) => key + 1)
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setBusy(false))
  }

  function assignAgent(value: string) {
    const ids = [...selected]
    setBusy(true)
    setNotice('')
    setError('')
    bulkUpdateProperties(ids, { agent_id: value === 'none' ? null : value })
      .then((failed) => {
        setNotice(bulkResultMessage(ids.length, failed))
        setRefreshKey((key) => key + 1)
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setBusy(false))
  }

  const allSelected = items.length > 0 && selected.size === items.length

  return (
    <>
      <div className="crm-head">
        <div>
          <p className="eyebrow">Portfolio · {total} listings</p>
          <h1>Properties</h1>
        </div>
        <Link to="/crm/properties/new">
          <Button>Add property</Button>
        </Link>
      </div>
      <form
        className="crm-filters"
        onSubmit={(event) => {
          event.preventDefault()
          setParam('q', search.trim())
        }}
      >
        <input
          aria-label="Search properties"
          placeholder="Search title, city or state"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Status"
          value={get('status')}
          onChange={(e) => setParam('status', e.target.value)}
        >
          <option value="">Any status</option>
          {PROPERTY_STATUSES.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Property type"
          value={get('type')}
          onChange={(e) => setParam('type', e.target.value)}
        >
          <option value="">Any type</option>
          {PROPERTY_TYPES.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Listing type"
          value={get('listing')}
          onChange={(e) => setParam('listing', e.target.value)}
        >
          <option value="">Sale or rent</option>
          {LISTING_TYPES.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Agent"
          value={get('agent')}
          onChange={(e) => setParam('agent', e.target.value)}
        >
          <option value="">All agents</option>
          <option value="none">Unassigned</option>
          <AgentOptions agents={agents} />
        </select>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {selected.size > 0 && (
        <div className="bulk-bar" role="region" aria-label="Bulk actions">
          <span>{selected.size} selected</span>
          <Button size="sm" loading={busy} onClick={() => bulk('publish')}>
            Publish
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() => bulk('archive')}
          >
            Archive
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() => bulk('restore')}
          >
            Move to draft
          </Button>
          {profile.role === 'admin' && (
            <BulkSelect
              label="Assign agent"
              disabled={busy}
              onPick={assignAgent}
            >
              <option value="none">Unassigned</option>
              <AgentOptions agents={agents.filter((agent) => agent.active)} />
            </BulkSelect>
          )}
          <button
            className="text-button"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice-inline">{notice}</p>}
      <div className="table">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(
                      allSelected ? new Set() : new Set(items.map((x) => x.id)),
                    )
                  }
                />
              </th>
              <th>Property</th>
              <th>Location</th>
              <th>Status</th>
              <th>Price</th>
              <th>Agent</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((x) => {
              const image = getPublicImageUrl(
                x.primaryImage?.storage_path ?? null,
              )
              return (
                <tr key={x.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${x.title}`}
                      checked={selected.has(x.id)}
                      onChange={() => toggle(x.id)}
                    />
                  </td>
                  <td>
                    <div className="property-cell">
                      {image ? (
                        <img src={image} alt="" />
                      ) : (
                        <span className="thumb-fallback">
                          <Home size={16} />
                        </span>
                      )}
                      <div>
                        <b>
                          <Link to={`/crm/properties/${x.id}/edit`}>
                            {x.title}
                          </Link>
                        </b>
                        <small>
                          {titleCase(x.property_type)} ·{' '}
                          {x.listing_type === 'sale' ? 'Sale' : 'Rent'}
                          {x.featured ? ' · Featured' : ''}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {x.city}, {x.region}
                  </td>
                  <td>
                    <span className={x.status}>{x.status}</span>
                  </td>
                  <td>{formatCurrency(x.price, x.currency)}</td>
                  <td>
                    {x.agent_id
                      ? (agentNames[x.agent_id] ?? 'Teammate')
                      : 'Unassigned'}
                  </td>
                  <td className="row-actions">
                    <Link
                      className="text-button"
                      to={`/crm/properties/${x.id}/edit`}
                    >
                      Edit
                    </Link>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true)
                        duplicateProperty(x.id, profile.id)
                          .then((copy) =>
                            navigate(`/crm/properties/${copy.id}/edit`),
                          )
                          .catch((e) => setError(getErrorMessage(e)))
                          .finally(() => setBusy(false))
                      }}
                    >
                      Duplicate
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!items.length && (
          <p className="table-empty">
            {filterKey.replace(/(^|&)page=\d+/, '')
              ? 'No properties match these filters.'
              : 'No properties yet.'}
          </p>
        )}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={(next) => setParam('page', String(next))}
      />
    </>
  )
}

export function NewPropertyPage({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<Profile[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    listAgents({ activeOnly: true })
      .then(setAgents)
      .catch(() => setAgents([]))
  }, [])
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    setLoading(true)
    createProperty({
      ...readPropertyForm(data),
      status: 'draft',
      created_by: profile.id,
      agent_id:
        profile.role === 'admin'
          ? String(data.get('agent_id') || '') || null
          : profile.id,
    })
      // Straight into the editor so photos can be added next; replace so
      // "Back" from the editor skips the now-submitted form.
      .then((property) =>
        navigate(`/crm/properties/${property.id}/edit`, { replace: true }),
      )
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false))
  }
  return (
    <>
      <BackLink fallback="/crm/properties" fallbackLabel="All properties" />
      <div className="crm-head">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1>Add a property</h1>
        </div>
      </div>
      <form className="property-form" onSubmit={submit}>
        <PropertyFields agents={agents} profile={profile} />
        {error && <p className="error">{error}</p>}
        <Button type="submit" loading={loading}>
          Create draft and add photos
        </Button>
      </form>
    </>
  )
}
