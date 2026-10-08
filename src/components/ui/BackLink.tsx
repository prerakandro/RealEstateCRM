import type { MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * "← Back": returns to the previous page when the user navigated here inside
 * the app (so lead → customer → back lands on the lead), otherwise goes to
 * `fallback` (labelled `fallbackLabel`), e.g. when the page was opened from
 * a bookmark or a new tab.
 */
export function BackLink({
  fallback,
  fallbackLabel,
}: {
  fallback: string
  fallbackLabel: string
}) {
  const navigate = useNavigate()
  const location = useLocation()
  // React Router gives the first page of a session the key "default".
  const hasHistory = location.key !== 'default'
  function back(event: MouseEvent<HTMLAnchorElement>) {
    if (!hasHistory) return
    event.preventDefault()
    navigate(-1)
  }
  return (
    <Link className="back" to={fallback} onClick={back}>
      <ArrowLeft size={14} aria-hidden="true" />{' '}
      {hasHistory ? 'Back' : fallbackLabel}
    </Link>
  )
}
