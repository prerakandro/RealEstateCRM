import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LEAD_STATUSES, formatINRShort, groupLeadsByStatus } from '@/lib/crm'
import { formatDate, titleCase } from '@/lib/utils'
import type { NameMap } from '@/services/lookups'
import type { Lead, LeadStatus } from '@/types/domain'
import { Pill } from './ui'

interface LeadBoardProps {
  leads: Lead[]
  customers: NameMap
  agents: NameMap
  onMove: (lead: Lead, status: LeadStatus) => void
}

/** Kanban view of the pipeline; drag a card to another column to move it. */
export function LeadBoard({
  leads,
  customers,
  agents,
  onMove,
}: LeadBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )
  const groups = groupLeadsByStatus(leads)
  function dragEnd({ active, over }: DragEndEvent) {
    const lead = leads.find((item) => item.id === active.id)
    const status = over?.id as LeadStatus | undefined
    if (lead && status && status !== lead.status) onMove(lead, status)
  }
  return (
    <DndContext sensors={sensors} onDragEnd={dragEnd}>
      <div className="lead-board" aria-label="Lead pipeline board">
        {LEAD_STATUSES.map((status) => (
          <Column key={status} status={status} count={groups[status].length}>
            {groups[status].map((lead) => (
              <Card
                key={lead.id}
                lead={lead}
                customer={customers[lead.customer_id]}
                agent={
                  lead.assigned_agent_id
                    ? agents[lead.assigned_agent_id]
                    : undefined
                }
              />
            ))}
          </Column>
        ))}
      </div>
    </DndContext>
  )
}

function Column({
  status,
  count,
  children,
}: {
  status: LeadStatus
  count: number
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      ref={setNodeRef}
      className={isOver ? 'lead-column over' : 'lead-column'}
      aria-label={`${titleCase(status)} leads`}
    >
      <h3>
        {titleCase(status)} <span>{count}</span>
      </h3>
      {children}
    </section>
  )
}

function Card({
  lead,
  customer,
  agent,
}: {
  lead: Lead
  customer?: string
  agent?: string
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: lead.id })
  return (
    <article
      ref={setNodeRef}
      className={isDragging ? 'lead-card dragging' : 'lead-card'}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
    >
      <Link to={`/crm/leads/${lead.id}`}>{lead.title}</Link>
      <small>{customer ?? 'Customer'}</small>
      <div>
        <Pill value={lead.priority} />
        {lead.expected_budget != null && (
          <small>{formatINRShort(lead.expected_budget)}</small>
        )}
      </div>
      <small>
        {agent ? `${agent} · ` : ''}
        {lead.next_follow_up_at
          ? `Next: ${formatDate(lead.next_follow_up_at)}`
          : 'No follow-up'}
      </small>
    </article>
  )
}
