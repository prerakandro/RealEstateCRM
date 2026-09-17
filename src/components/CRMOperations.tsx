import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { getErrorMessage, formatDate, titleCase } from '@/lib/utils'
import { listAgents } from '@/services/agents'
import {
  createCustomer,
  listCustomers,
  updateCustomer,
} from '@/services/customers'
import { listLeads, updateLead } from '@/services/leads'
import { listFollowUps, updateFollowUp } from '@/services/followUps'
import { listSiteVisits, updateSiteVisit } from '@/services/siteVisits'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notifications'
import type {
  Customer,
  Lead,
  Profile,
  FollowUp,
  SiteVisit,
  Notification,
} from '@/types/domain'

function State({ error, empty }: { error: string; empty: string }) {
  if (error) return <p className="error">{error}</p>
  return <p className="table-empty">{empty}</p>
}

export function CustomersPage({ profile }: { profile: Profile }) {
  const [items, setItems] = useState<Customer[]>([]),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [agents, setAgents] = useState<Profile[]>([]),
    [showForm, setShowForm] = useState(false)
  const refresh = () =>
    Promise.all([
      listCustomers({ query: query || undefined, page: 1, pageSize: 50 }),
      listAgents({ activeOnly: true }),
    ])
      .then(([customersResult, agentList]) => {
        setItems(customersResult.data)
        setAgents(agentList)
      })
      .catch((e) => setError(getErrorMessage(e)))
  useEffect(() => {
    void refresh()
  }, [query])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    createCustomer({
      full_name: String(form.get('full_name')),
      email: String(form.get('email') || '') || null,
      phone: String(form.get('phone') || '') || null,
      source: 'other',
      customer_type: String(form.get('customer_type')) as never,
      created_by: profile.id,
    })
      .then(() => {
        setShowForm(false)
        void refresh()
      })
      .catch((e) => setError(getErrorMessage(e)))
  }
  return (
    <>
      <div className="crm-head">
        <div>
          <p className="eyebrow">Relationship management</p>
          <h1>Customers</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Close' : 'Add customer'}
        </Button>
      </div>
      {showForm && (
        <form className="invite-form" onSubmit={submit}>
          <input required name="full_name" placeholder="Full name" />
          <input name="email" type="email" placeholder="Email" />
          <input name="phone" placeholder="Phone" />
          <select name="customer_type">
            <option value="buyer">Buyer</option>
            <option value="tenant">Tenant</option>
            <option value="investor">Investor</option>
            <option value="seller">Seller</option>
          </select>
          <Button type="submit">Create customer</Button>
        </form>
      )}
      <input
        className="workspace-search"
        placeholder="Search customers"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="table">
        <table>
          <thead>
            <tr>
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
                  <b>{item.full_name}</b>
                  <small>
                    {item.email || item.phone || 'No contact details'}
                  </small>
                </td>
                <td>{titleCase(item.customer_type)}</td>
                <td>{titleCase(item.customer_status)}</td>
                <td>
                  {profile.role === 'admin' ? (
                    <select
                      value={item.assigned_agent_id ?? ''}
                      onChange={(e) =>
                        updateCustomer(item.id, {
                          assigned_agent_id: e.target.value || null,
                        })
                          .then(refresh)
                          .catch((error) => setError(getErrorMessage(error)))
                      }
                    >
                      <option value="">Unassigned</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.full_name}
                        </option>
                      ))}
                    </select>
                  ) : item.assigned_agent_id === profile.id ? (
                    'You'
                  ) : (
                    item.assigned_agent_id || 'Unassigned'
                  )}
                </td>
                <td>{formatDate(item.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <State error={error} empty="No customers yet." />}
      </div>
    </>
  )
}

export function LeadsPage({ profile }: { profile: Profile }) {
  const [items, setItems] = useState<Lead[]>([]),
    [error, setError] = useState(''),
    [status, setStatus] = useState(''),
    [agents, setAgents] = useState<Profile[]>([])
  const refresh = () =>
    Promise.all([
      listLeads({
        status: (status || undefined) as never,
        assignedAgentId: profile.role === 'agent' ? profile.id : undefined,
        page: 1,
        pageSize: 100,
      }),
      listAgents({ activeOnly: true }),
    ])
      .then(([leadResult, agentList]) => {
        setItems(leadResult.data)
        setAgents(agentList)
      })
      .catch((e) => setError(getErrorMessage(e)))
  useEffect(() => {
    void refresh()
  }, [status, profile.id])
  const changeStatus = (id: string, next: string) =>
    updateLead(id, { status: next as never })
      .then(refresh)
      .catch((e) => setError(getErrorMessage(e)))
  return (
    <>
      <div className="crm-head">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h1>Leads</h1>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All stages</option>
          {[
            'new',
            'contacted',
            'qualified',
            'site_visit_scheduled',
            'negotiation',
            'converted',
            'lost',
            'closed',
          ].map((x) => (
            <option key={x} value={x}>
              {titleCase(x)}
            </option>
          ))}
        </select>
      </div>
      <div className="table">
        <table>
          <thead>
            <tr>
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
                  <b>{item.title}</b>
                  <small>Customer {item.customer_id}</small>
                </td>
                <td>
                  <select
                    value={item.status}
                    onChange={(e) => changeStatus(item.id, e.target.value)}
                  >
                    {[
                      'new',
                      'contacted',
                      'qualified',
                      'site_visit_scheduled',
                      'negotiation',
                      'converted',
                      'lost',
                      'closed',
                    ].map((x) => (
                      <option key={x} value={x}>
                        {titleCase(x)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{titleCase(item.priority)}</td>
                <td>
                  {profile.role === 'admin' ? (
                    <select
                      value={item.assigned_agent_id ?? ''}
                      onChange={(e) =>
                        updateLead(item.id, {
                          assigned_agent_id: e.target.value || null,
                        })
                          .then(refresh)
                          .catch((error) => setError(getErrorMessage(error)))
                      }
                    >
                      <option value="">Unassigned</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.full_name}
                        </option>
                      ))}
                    </select>
                  ) : item.assigned_agent_id === profile.id ? (
                    'You'
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
          <State error={error} empty="No leads match this view." />
        )}
      </div>
    </>
  )
}

export function FollowUpsPage({ profile }: { profile: Profile }) {
  const [items, setItems] = useState<FollowUp[]>([]),
    [error, setError] = useState('')
  const refresh = () =>
    listFollowUps({
      assignedAgentId: profile.role === 'agent' ? profile.id : undefined,
    })
      .then(setItems)
      .catch((e) => setError(getErrorMessage(e)))
  useEffect(() => {
    void refresh()
  }, [profile.id])
  return (
    <>
      <div className="crm-head">
        <div>
          <p className="eyebrow">Next actions</p>
          <h1>Follow-ups</h1>
        </div>
      </div>
      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Type</th>
              <th>Scheduled</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <b>{item.title}</b>
                  <small>Customer {item.customer_id}</small>
                </td>
                <td>{titleCase(item.follow_up_type)}</td>
                <td>{formatDate(item.scheduled_at)}</td>
                <td>{titleCase(item.status)}</td>
                <td>
                  {item.status === 'pending' && (
                    <button
                      className="text-button"
                      onClick={() =>
                        updateFollowUp(item.id, { status: 'completed' })
                          .then(refresh)
                          .catch((e) => setError(getErrorMessage(e)))
                      }
                    >
                      Complete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <State error={error} empty="No follow-ups scheduled." />
        )}
      </div>
    </>
  )
}

export function SiteVisitsPage({ profile }: { profile: Profile }) {
  const [items, setItems] = useState<SiteVisit[]>([]),
    [error, setError] = useState('')
  const refresh = () =>
    listSiteVisits({
      agentId: profile.role === 'agent' ? profile.id : undefined,
    })
      .then(setItems)
      .catch((e) => setError(getErrorMessage(e)))
  useEffect(() => {
    void refresh()
  }, [profile.id])
  return (
    <>
      <div className="crm-head">
        <div>
          <p className="eyebrow">Appointments</p>
          <h1>Site visits</h1>
        </div>
      </div>
      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Property</th>
              <th>Scheduled</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.customer_id}</td>
                <td>{item.property_id}</td>
                <td>{formatDate(item.scheduled_at)}</td>
                <td>{titleCase(item.status)}</td>
                <td>
                  {item.status === 'scheduled' && (
                    <button
                      className="text-button"
                      onClick={() =>
                        updateSiteVisit(item.id, { status: 'confirmed' })
                          .then(refresh)
                          .catch((e) => setError(getErrorMessage(e)))
                      }
                    >
                      Confirm
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <State error={error} empty="No site visits scheduled." />
        )}
      </div>
    </>
  )
}

export function NotificationsPage({ profile }: { profile: Profile }) {
  const [items, setItems] = useState<Notification[]>([]),
    [error, setError] = useState('')
  const refresh = () =>
    listNotifications({ userId: profile.id, limit: 50 })
      .then(setItems)
      .catch((e) => setError(getErrorMessage(e)))
  useEffect(() => {
    void refresh()
  }, [profile.id])
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
          </article>
        ))}
        {!items.length && (
          <State error={error} empty="You are all caught up." />
        )}
      </div>
    </>
  )
}
