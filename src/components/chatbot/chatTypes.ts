import type { ChatEnquiryTarget } from '@/services/chatAssistant'
import type { PropertySearchItem } from '@/types/domain'

export interface UserEntry {
  id: string
  role: 'user'
  text: string
}

export interface AssistantEntry {
  id: string
  role: 'assistant'
  text: string
  properties?: PropertySearchItem[]
  enquiry?: ChatEnquiryTarget | null
  suggestions?: string[]
}

export interface ErrorEntry {
  id: string
  role: 'error'
  text: string
}

export type ChatEntry = UserEntry | AssistantEntry | ErrorEntry

let sequence = 0
export const nextId = () => `chat-${Date.now().toString(36)}-${(sequence += 1)}`

export const WELCOME_TEXT =
  'Hi! I can help you find properties, answer property-related questions, or help you submit an enquiry.'

export const GENERAL_SUGGESTIONS = [
  'Find a property',
  'Properties for sale',
  'Properties for rent',
  'Find properties within my budget',
  'Show 2 BHK properties',
  'Contact an agent',
]

export const PROPERTY_PAGE_SUGGESTIONS = [
  'Tell me about this property',
  'What is the price?',
  'How many bedrooms does it have?',
  'I want to enquire about this property',
]
