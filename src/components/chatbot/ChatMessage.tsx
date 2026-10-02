import { Link } from 'react-router-dom'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { PropertyCard } from '@/components/PropertyCard'
import type { PropertySearchItem } from '@/types/domain'
import { ChatEnquiryForm } from './ChatEnquiryForm'
import type { ChatEntry } from './chatTypes'

interface ChatMessageProps {
  entry: ChatEntry
  isLatest: boolean
  busy: boolean
  onSuggestion: (text: string) => void
  onRetry: () => void
  onEnquire: (property: PropertySearchItem) => void
  onNavigate: () => void
}

export function ChatMessage({
  entry,
  isLatest,
  busy,
  onSuggestion,
  onRetry,
  onEnquire,
  onNavigate,
}: ChatMessageProps) {
  if (entry.role === 'user')
    return (
      <div className="chat-row chat-row-user">
        <p className="chat-bubble chat-bubble-user">
          <span className="sr-only">You said: </span>
          {entry.text}
        </p>
      </div>
    )

  if (entry.role === 'error')
    return (
      <ChatErrorState text={entry.text} onRetry={isLatest ? onRetry : null} />
    )

  return (
    <div className="chat-row chat-row-assistant">
      <p className="chat-bubble chat-bubble-assistant">
        <span className="sr-only">Assistant: </span>
        {entry.text}
      </p>
      {entry.properties && entry.properties.length > 0 && (
        <PropertyResults
          properties={entry.properties}
          onEnquire={onEnquire}
          onNavigate={onNavigate}
        />
      )}
      {entry.enquiry && <ChatEnquiryForm target={entry.enquiry} />}
      {isLatest && entry.suggestions && entry.suggestions.length > 0 && (
        <SuggestedQuestions
          items={entry.suggestions}
          disabled={busy}
          onSelect={onSuggestion}
        />
      )}
    </div>
  )
}

export function PropertyResults({
  properties,
  onEnquire,
  onNavigate,
}: {
  properties: PropertySearchItem[]
  onEnquire: (property: PropertySearchItem) => void
  onNavigate: () => void
}) {
  return (
    <ul className="chat-results" aria-label="Matching properties">
      {properties.map((property) => (
        <li key={property.id}>
          <PropertyCard
            compact
            property={property}
            onNavigate={onNavigate}
            footer={
              <div className="chat-card-actions">
                <Link
                  className="chat-card-link"
                  to={`/properties/${property.slug}`}
                  onClick={onNavigate}
                  aria-label={`View details for ${property.title}`}
                >
                  View details
                </Link>
                <button
                  type="button"
                  className="chat-card-button"
                  onClick={() => onEnquire(property)}
                  aria-label={`Send an enquiry about ${property.title}`}
                >
                  Enquire
                </button>
              </div>
            }
          />
        </li>
      ))}
    </ul>
  )
}

export function SuggestedQuestions({
  items,
  disabled,
  onSelect,
}: {
  items: string[]
  disabled?: boolean
  onSelect: (text: string) => void
}) {
  return (
    <div className="chat-suggestions" role="group" aria-label="Suggestions">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(item)}
        >
          {item}
        </button>
      ))}
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="chat-row chat-row-assistant" role="status">
      <div className="chat-bubble chat-bubble-assistant chat-typing">
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span className="sr-only">The assistant is looking that up…</span>
      </div>
    </div>
  )
}

export function ChatErrorState({
  text,
  onRetry,
}: {
  text: string
  onRetry: (() => void) | null
}) {
  return (
    <div className="chat-row chat-row-assistant">
      <div className="chat-error" role="alert">
        <AlertCircle aria-hidden="true" />
        <p>{text}</p>
        {onRetry && (
          <button type="button" onClick={onRetry}>
            <RotateCcw aria-hidden="true" /> Retry
          </button>
        )}
      </div>
    </div>
  )
}
