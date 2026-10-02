import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { MessageCircle, Minus, RotateCcw, SendHorizontal } from 'lucide-react'
import { getErrorMessage } from '@/lib/utils'
import {
  clearAssistantCache,
  initialConversation,
  respond,
  type ConversationState,
} from '@/services/chatAssistant'
import type { PropertySearchItem } from '@/types/domain'
import { ChatMessage, SuggestedQuestions, TypingIndicator } from './ChatMessage'
import {
  GENERAL_SUGGESTIONS,
  nextId,
  PROPERTY_PAGE_SUGGESTIONS,
  WELCOME_TEXT,
  type ChatEntry,
} from './chatTypes'
import './chatbot.css'

const PUBLIC_PATHS = ['/', '/properties', '/properties/:slug']
const MAX_MESSAGE_LENGTH = 500

const isSmallScreen = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(max-width: 640px)').matches

/** Shown only on public portal pages; never in the CRM or auth screens. */
export function ChatbotWidget() {
  const { pathname } = useLocation()
  const visible = PUBLIC_PATHS.some((path) => matchPath(path, pathname))
  if (!visible) return null
  return <Chatbot pathname={pathname} />
}

function Chatbot({ pathname }: { pathname: string }) {
  const propertySlug =
    matchPath('/properties/:slug', pathname)?.params.slug ?? null
  const panelId = useId()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [conversation, setConversation] =
    useState<ConversationState>(initialConversation)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [entries, busy, open])

  const minimize = useCallback(() => {
    setOpen(false)
    launcherRef.current?.focus()
  }, [])

  const request = useCallback(
    async (text: string, state: ConversationState) => {
      setBusy(true)
      try {
        const turn = await respond(text, state, { propertySlug })
        setConversation(turn.state)
        setEntries((current) => [
          ...current,
          {
            id: nextId(),
            role: 'assistant',
            text: turn.reply,
            properties: turn.properties,
            enquiry: turn.enquiry,
            suggestions: turn.suggestions,
          },
        ])
      } catch (error) {
        setEntries((current) => [
          ...current,
          {
            id: nextId(),
            role: 'error',
            text: `Sorry, I couldn't load property information. ${getErrorMessage(error)}`,
          },
        ])
      } finally {
        setBusy(false)
      }
    },
    [propertySlug],
  )

  function send(raw: string) {
    const text = raw.trim().slice(0, MAX_MESSAGE_LENGTH)
    if (!text || busy) return
    setEntries((current) => [
      ...current.filter((entry) => entry.role !== 'error'),
      { id: nextId(), role: 'user', text },
    ])
    setDraft('')
    void request(text, conversation)
  }

  // State only advances on success, so retrying replays the last message.
  function retry() {
    const last = entries.findLast((entry) => entry.role === 'user')
    if (busy || !last) return
    setEntries((current) => current.filter((entry) => entry.role !== 'error'))
    void request(last.text, conversation)
  }

  function restart() {
    if (busy) return
    setEntries([])
    setConversation(initialConversation())
    clearAssistantCache()
    setDraft('')
    inputRef.current?.focus()
  }

  function openEnquiry(property: PropertySearchItem) {
    setEntries((current) => [
      ...current,
      {
        id: nextId(),
        role: 'assistant',
        text: `Great choice. Share your details and an advisor will get back to you about ${property.title}.`,
        enquiry: {
          propertyId: property.id,
          propertySlug: property.slug,
          propertyTitle: property.title,
        },
      },
    ])
  }

  function onNavigate() {
    if (isSmallScreen()) setOpen(false)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    send(draft)
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      send(draft)
    }
  }

  function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      minimize()
    }
  }

  const welcomeSuggestions = propertySlug
    ? PROPERTY_PAGE_SUGGESTIONS
    : GENERAL_SUGGESTIONS

  return (
    <div className="chatbot">
      {open && (
        <div
          className="chat-panel"
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          onKeyDown={onPanelKeyDown}
        >
          <div className="chat-header">
            <span className="chat-avatar" aria-hidden="true">
              H
            </span>
            <div>
              <h2 id={titleId}>Property assistant</h2>
              <p>Haven &amp; Key · answers from our live listings</p>
            </div>
            <button
              type="button"
              className="chat-icon-button"
              onClick={restart}
              disabled={busy || entries.length === 0}
              aria-label="Start a new conversation"
              title="Start over"
            >
              <RotateCcw aria-hidden="true" />
            </button>
            <button
              type="button"
              className="chat-icon-button"
              onClick={minimize}
              aria-label="Minimise assistant"
              title="Minimise"
            >
              <Minus aria-hidden="true" />
            </button>
          </div>

          <div
            className="chat-log"
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-busy={busy}
          >
            <div className="chat-row chat-row-assistant">
              <p className="chat-bubble chat-bubble-assistant">
                {WELCOME_TEXT}
                {propertySlug &&
                  ' Ask me anything about the property you are viewing.'}
              </p>
              {entries.length === 0 && (
                <SuggestedQuestions
                  items={welcomeSuggestions}
                  disabled={busy}
                  onSelect={send}
                />
              )}
            </div>
            {entries.map((entry, index) => (
              <ChatMessage
                key={entry.id}
                entry={entry}
                isLatest={index === entries.length - 1}
                busy={busy}
                onSuggestion={send}
                onRetry={retry}
                onEnquire={openEnquiry}
                onNavigate={onNavigate}
              />
            ))}
            {busy && <TypingIndicator />}
          </div>

          <form className="chat-input" onSubmit={submit}>
            <label htmlFor={`${panelId}-input`} className="sr-only">
              Message the property assistant
            </label>
            <textarea
              id={`${panelId}-input`}
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="e.g. 2 BHK in Jaipur under 50 lakh"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onInputKeyDown}
            />
            <button
              type="submit"
              className="chat-send"
              disabled={busy || !draft.trim()}
              aria-label="Send message"
            >
              <SendHorizontal aria-hidden="true" />
            </button>
          </form>
          <p className="chat-disclaimer">
            Automated assistant. Answers come from our published listings;
            please confirm details with an advisor.
          </p>
        </div>
      )}

      <button
        ref={launcherRef}
        type="button"
        className="chat-launcher"
        data-open={open || undefined}
        onClick={() => (open ? minimize() : setOpen(true))}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={
          open ? 'Minimise property assistant' : 'Open property assistant'
        }
      >
        <MessageCircle aria-hidden="true" />
        <span>{open ? 'Close' : 'Ask us'}</span>
      </button>
    </div>
  )
}
