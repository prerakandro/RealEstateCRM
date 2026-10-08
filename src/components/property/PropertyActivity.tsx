import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime } from '@/lib/crm'
import { getErrorMessage } from '@/lib/utils'
import { listLeads } from '@/services/leads'
import { listSiteVisits } from '@/services/siteVisits'
import { getCustomerNames, type NameMap } from '@/services/lookups'
import type { Lead, SiteVisit } from '@/types/domain'
import { Pill } from '@/components/crm/ui'

/** Leads and site-visit history for one listing (property editor sidebar). */
export function PropertyActivity({ propertyId }: { propertyId: string }) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [visits, setVisits] = useState<SiteVisit[]>([])
  const [customers, setCustomers] = useState<NameMap>({})
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    Promise.all([
      listLeads({ propertyId, page: 1, pageSize: 50 }),
      listSiteVisits({ propertyId }),
    ])
      .then(async ([leadResult, visitRows]) => {
        const names = await getCustomerNames([
          ...leadResult.data.map((lead) => lead.customer_id),
          ...visitRows.map((visit) => visit.customer_id),
        ])
        if (cancelled) return
        setLeads(leadResult.data)
        // Newest visits first: this is a history.
        setVisits([...visitRows].reverse())
        setCustomers(names)
      })
      .catch((e) => !cancelled && setError(getErrorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [propertyId])
  const completed = visits.filter((visit) => visit.status === 'completed')
  return (
    <section className="image-manager property-activity">
      <h2>Interest</h2>
      <p>
        {leads.length} lead{leads.length === 1 ? '' : 's'} · {visits.length}{' '}
        site visit{visits.length === 1 ? '' : 's'} ({completed.length}{' '}
        completed)
      </p>
      {error && <p className="error">{error}</p>}
      <h3>Leads</h3>
      <ul className="activity-list">
        {leads.map((lead) => (
          <li key={lead.id}>
            <Link to={`/crm/leads/${lead.id}`}>
              {customers[lead.customer_id] ?? lead.title}
            </Link>
            <span>
              <Pill value={lead.status} />
              <Pill value={lead.priority} />
            </span>
          </li>
        ))}
        {!leads.length && <li className="table-empty">No leads yet.</li>}
      </ul>
      <h3>Site visit history</h3>
      <ul className="activity-list">
        {visits.map((visit) => (
          <li key={visit.id}>
            <strong>{customers[visit.customer_id] ?? 'Customer'}</strong>
            <span>
              {formatDateTime(visit.scheduled_at)} <Pill value={visit.status} />
            </span>
            {visit.outcome && <small>{visit.outcome}</small>}
          </li>
        ))}
        {!visits.length && <li className="table-empty">No visits yet.</li>}
      </ul>
    </section>
  )
}
