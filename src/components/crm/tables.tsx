import { Link } from 'react-router-dom'
import { SITE_VISIT_STATUSES, followUpBucket, formatDateTime } from '@/lib/crm'
import { getErrorMessage, titleCase } from '@/lib/utils'
import { updateFollowUp } from '@/services/followUps'
import { updateSiteVisit } from '@/services/siteVisits'
import type { NameMap } from '@/services/lookups'
import type {
  FollowUp,
  FollowUpStatus,
  SiteVisit,
  SiteVisitStatus,
} from '@/types/domain'
import { Pill, SelectOptions } from './ui'

interface TableProps<T> {
  items: T[]
  agents: NameMap
  /** Pass to show a customer column (list pages); omit on detail pages. */
  customers?: NameMap
  onChanged: () => void
  onError: (message: string) => void
  empty?: string
}

export function FollowUpTable({
  items,
  agents,
  customers,
  onChanged,
  onError,
  empty = 'No follow-ups yet.',
}: TableProps<FollowUp>) {
  const set = (item: FollowUp, status: FollowUpStatus) =>
    updateFollowUp(item.id, { status })
      .then(onChanged)
      .catch((e) => onError(getErrorMessage(e)))
  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            <th>Task</th>
            {customers && <th>Customer</th>}
            <th>When</th>
            <th>Status</th>
            <th>Owner</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const bucket = followUpBucket(item.scheduled_at, item.status)
            return (
              <tr key={item.id}>
                <td>
                  <b>{item.title}</b>
                  <small>
                    {titleCase(item.follow_up_type)} ·{' '}
                    {titleCase(item.priority)} priority
                    {item.lead_id && (
                      <>
                        {' · '}
                        <Link to={`/crm/leads/${item.lead_id}`}>Lead</Link>
                      </>
                    )}
                  </small>
                  {item.notes && <small>{item.notes}</small>}
                </td>
                {customers && (
                  <td>
                    <Link to={`/crm/customers/${item.customer_id}`}>
                      {customers[item.customer_id] ?? 'Customer'}
                    </Link>
                  </td>
                )}
                <td>
                  {formatDateTime(item.scheduled_at)}
                  {bucket === 'overdue' && <Pill value="overdue" />}
                  {bucket === 'today' && <Pill value="today" />}
                </td>
                <td>
                  <Pill value={item.status} />
                </td>
                <td>
                  {item.assigned_agent_id
                    ? (agents[item.assigned_agent_id] ?? 'Teammate')
                    : 'Unassigned'}
                </td>
                <td className="row-actions">
                  {item.status === 'pending' ? (
                    <>
                      <button
                        className="text-button"
                        onClick={() => set(item, 'completed')}
                      >
                        Complete
                      </button>
                      <button
                        className="text-button"
                        onClick={() => set(item, 'missed')}
                      >
                        Missed
                      </button>
                      <button
                        className="text-button"
                        onClick={() => set(item, 'cancelled')}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="text-button"
                      onClick={() => set(item, 'pending')}
                    >
                      Reopen
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!items.length && <p className="table-empty">{empty}</p>}
    </div>
  )
}

export function SiteVisitTable({
  items,
  agents,
  customers,
  properties,
  onChanged,
  onError,
  empty = 'No site visits yet.',
}: TableProps<SiteVisit> & { properties: NameMap }) {
  const save = (item: SiteVisit, input: Partial<SiteVisit>) =>
    updateSiteVisit(item.id, input)
      .then(onChanged)
      .catch((e) => onError(getErrorMessage(e)))
  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            <th>Property</th>
            {customers && <th>Customer</th>}
            <th>When</th>
            <th>Status</th>
            <th>Agent</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <b>
                  <Link to={`/crm/properties/${item.property_id}/edit`}>
                    {properties[item.property_id] ?? 'Property'}
                  </Link>
                </b>
                {item.lead_id && (
                  <small>
                    <Link to={`/crm/leads/${item.lead_id}`}>Open lead</Link>
                  </small>
                )}
                {item.notes && <small>{item.notes}</small>}
              </td>
              {customers && (
                <td>
                  <Link to={`/crm/customers/${item.customer_id}`}>
                    {customers[item.customer_id] ?? 'Customer'}
                  </Link>
                </td>
              )}
              <td>{formatDateTime(item.scheduled_at)}</td>
              <td>
                <select
                  aria-label="Visit status"
                  value={item.status}
                  onChange={(e) =>
                    save(item, { status: e.target.value as SiteVisitStatus })
                  }
                >
                  <SelectOptions values={SITE_VISIT_STATUSES} />
                </select>
              </td>
              <td>
                {item.agent_id
                  ? (agents[item.agent_id] ?? 'Teammate')
                  : 'Unassigned'}
              </td>
              <td>
                <input
                  className="inline-input"
                  aria-label="Visit outcome"
                  placeholder="Add outcome"
                  defaultValue={item.outcome ?? ''}
                  onBlur={(e) => {
                    const outcome = e.target.value.trim() || null
                    if (outcome !== item.outcome) save(item, { outcome })
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <p className="table-empty">{empty}</p>}
    </div>
  )
}
