import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/crm'
import { getErrorMessage, titleCase } from '@/lib/utils'
import { listCustomerOptions, type Option } from '@/services/lookups'
import { addNote, deleteNote, listNotes } from '@/services/notes'
import { listTimeline } from '@/services/activities'
import type { Activity, CrmNote, Profile } from '@/types/domain'

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="pagination">
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </Button>
      <span>
        Page {page} of {totalPages}
      </span>
      <Button
        variant="secondary"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </div>
  )
}

/** Dark bar shown while rows are selected; children are the actions. */
export function BulkBar({
  count,
  onClear,
  children,
}: {
  count: number
  onClear: () => void
  children: ReactNode
}) {
  if (!count) return null
  return (
    <div className="bulk-bar" role="region" aria-label="Bulk actions">
      <span>{count} selected</span>
      {children}
      <button className="text-button" onClick={onClear}>
        Clear
      </button>
    </div>
  )
}

/** A select that runs an action on pick and resets to its placeholder. */
export function BulkSelect({
  label,
  disabled,
  onPick,
  children,
}: {
  label: string
  disabled?: boolean
  onPick: (value: string) => void
  children: ReactNode
}) {
  return (
    <select
      aria-label={label}
      value=""
      disabled={disabled}
      onChange={(e) => e.target.value && onPick(e.target.value)}
    >
      <option value="">{label}…</option>
      {children}
    </select>
  )
}

/** Coloured status label; the tone class comes from the value itself. */
export function Pill({ value }: { value: string }) {
  return <span className={`pill pill-${value}`}>{titleCase(value)}</span>
}

export function SelectOptions({
  values,
  any,
}: {
  values: readonly string[]
  any?: string
}) {
  return (
    <>
      {any !== undefined && <option value="">{any}</option>}
      {values.map((value) => (
        <option key={value} value={value}>
          {titleCase(value)}
        </option>
      ))}
    </>
  )
}

export function AgentOptions({
  agents,
  any,
}: {
  agents: Profile[]
  any?: string
}) {
  return (
    <>
      {any !== undefined && <option value="">{any}</option>}
      {agents.map((agent) => (
        <option key={agent.id} value={agent.id}>
          {agent.full_name}
          {agent.active ? '' : ' (inactive)'}
        </option>
      ))}
    </>
  )
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Search box plus select for choosing an existing customer. */
export function CustomerPicker({ name = 'customer_id' }: { name?: string }) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<Option[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => {
      listCustomerOptions(query)
        .then(setOptions)
        .catch((e) => setError(getErrorMessage(e)))
    }, 250)
    return () => clearTimeout(timer)
  }, [query])
  return (
    <div className="customer-picker">
      <input
        aria-label="Search customers"
        placeholder="Search customer by name, phone or email"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select required name={name} aria-label="Customer">
        <option value="">Choose a customer…</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

export function NotesPanel({
  customerId,
  leadId,
  profile,
}: {
  customerId: string
  leadId?: string
  profile: Profile
}) {
  const [notes, setNotes] = useState<CrmNote[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  useEffect(() => {
    listNotes(leadId ? { leadId } : { customerId })
      .then(setNotes)
      .catch((e) => setError(getErrorMessage(e)))
  }, [customerId, leadId, refreshKey])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const body = String(new FormData(form).get('body') ?? '').trim()
    if (!body) return
    setSaving(true)
    addNote({ customerId, leadId, body, authorId: profile.id })
      .then(() => {
        form.reset()
        setRefreshKey((key) => key + 1)
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setSaving(false))
  }
  return (
    <Panel title="Notes">
      <form className="note-form" onSubmit={submit}>
        <textarea
          name="body"
          required
          maxLength={5000}
          aria-label="New note"
          placeholder="Add a note: call summary, requirements, objections…"
        />
        <Button type="submit" loading={saving}>
          Add note
        </Button>
      </form>
      {error && <p className="error">{error}</p>}
      <ul className="note-list">
        {notes.map((note) => (
          <li key={note.id}>
            <p>{note.body}</p>
            <small>
              {formatDateTime(note.created_at)}
              {(profile.role === 'admin' || note.created_by === profile.id) && (
                <button
                  className="text-button"
                  onClick={() =>
                    deleteNote(note.id)
                      .then(() => setRefreshKey((key) => key + 1))
                      .catch((e) => setError(getErrorMessage(e)))
                  }
                >
                  Delete
                </button>
              )}
            </small>
          </li>
        ))}
        {!notes.length && <li className="table-empty">No notes yet.</li>}
      </ul>
    </Panel>
  )
}

export function TimelinePanel({
  target,
  refreshKey = 0,
}: {
  target: { leadId: string } | { customerId: string }
  refreshKey?: number
}) {
  const [items, setItems] = useState<Activity[]>([])
  const [error, setError] = useState('')
  const id = 'leadId' in target ? target.leadId : target.customerId
  const isLead = 'leadId' in target
  useEffect(() => {
    listTimeline(isLead ? { leadId: id } : { customerId: id })
      .then(setItems)
      .catch((e) => setError(getErrorMessage(e)))
  }, [id, isLead, refreshKey])
  return (
    <Panel title="Timeline">
      {error && <p className="error">{error}</p>}
      <ul className="activity-list">
        {items.map((event) => (
          <li key={event.id}>
            <strong>{event.action.replaceAll('_', ' ')}</strong>
            <span>{event.description}</span>
            <small>{formatDateTime(event.created_at)}</small>
          </li>
        ))}
      </ul>
      {!items.length && !error && (
        <p className="table-empty">No activity recorded yet.</p>
      )}
    </Panel>
  )
}
