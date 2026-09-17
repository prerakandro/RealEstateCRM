import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { inviteAgent, listAgents, setAgentActive } from '@/services/agents'
import { listEnquiries, updateEnquiryStatus } from '@/services/enquiries'
import { formatDate, getErrorMessage } from '@/lib/utils'
import type { Enquiry, Profile } from '@/types/domain'
import { ENQUIRY_STATUSES } from '@/types/domain'

export function AgentsPage({ profile }: { profile: Profile }) {
  const [agents, setAgents] = useState<Profile[]>([])
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const refresh = () =>
    listAgents()
      .then(setAgents)
      .catch((e) => setError(getErrorMessage(e)))
  useEffect(() => {
    void refresh()
  }, [])
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (profile.role !== 'admin') return
    const form = new FormData(e.currentTarget)
    setSending(true)
    inviteAgent({
      full_name: String(form.get('name')),
      email: String(form.get('email')),
      phone: String(form.get('phone') || ''),
      role: String(form.get('role')) as 'admin' | 'agent',
    })
      .then(() => {
        e.currentTarget.reset()
        refresh()
      })
      .catch((x) => setError(getErrorMessage(x)))
      .finally(() => setSending(false))
  }
  return (
    <>
      <div className="crm-head">
        <div>
          <p className="eyebrow">Team</p>
          <h1>Agents</h1>
        </div>
      </div>
      {profile.role === 'admin' && (
        <form className="invite-form" onSubmit={submit}>
          <input required name="name" placeholder="Full name" />
          <input
            required
            name="email"
            type="email"
            placeholder="Email address"
          />
          <input name="phone" placeholder="Phone (optional)" />
          <select name="role">
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </select>
          <Button loading={sending}>Invite agent</Button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Role</th>
              <th>Phone</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id}>
                <td>
                  <b>{agent.full_name}</b>
                  <small>{agent.email}</small>
                </td>
                <td>{agent.role}</td>
                <td>{agent.phone || '—'}</td>
                <td>{agent.active ? 'Active' : 'Inactive'}</td>
                <td>
                  {profile.role === 'admin' && agent.id !== profile.id && (
                    <button
                      className="text-button"
                      onClick={() =>
                        setAgentActive(agent.id, !agent.active)
                          .then(refresh)
                          .catch((e) => setError(getErrorMessage(e)))
                      }
                    >
                      {agent.active ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function EnquiriesPage() {
  const [items, setItems] = useState<Enquiry[]>([])
  const [error, setError] = useState('')
  const refresh = () =>
    listEnquiries()
      .then(setItems)
      .catch((e) => setError(getErrorMessage(e)))
  useEffect(() => {
    void refresh()
  }, [])
  return (
    <>
      <div className="crm-head">
        <div>
          <p className="eyebrow">Leads</p>
          <h1>Enquiries</h1>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Contact</th>
              <th>Message</th>
              <th>Received</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <b>{item.name}</b>
                  <small>
                    {item.email}
                    {item.phone ? ` · ${item.phone}` : ''}
                  </small>
                </td>
                <td>{item.message}</td>
                <td>{formatDate(item.created_at)}</td>
                <td>
                  <select
                    value={item.status}
                    onChange={(e) =>
                      updateEnquiryStatus(
                        item.id,
                        e.target.value as Enquiry['status'],
                      )
                        .then(refresh)
                        .catch((x) => setError(getErrorMessage(x)))
                    }
                  >
                    {ENQUIRY_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <p className="table-empty">No enquiries yet.</p>}
      </div>
    </>
  )
}
