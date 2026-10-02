import { useId, useState, type FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { getErrorMessage } from '@/lib/utils'
import { createEnquiry } from '@/services/enquiries'
import type { ChatEnquiryTarget } from '@/services/chatAssistant'

const enquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter your name.')
    .max(120, 'Name is too long.'),
  email: z.email('Please enter a valid email address.').max(254),
  phone: z
    .string()
    .trim()
    .max(20, 'Phone number is too long.')
    .refine(
      (value) => value === '' || /^\+?[\d\s()-]{7,20}$/.test(value),
      'Please enter a valid phone number.',
    ),
  message: z
    .string()
    .trim()
    .min(5, 'Please add a short message.')
    .max(2000, 'Message is too long.'),
})

type Field = keyof z.infer<typeof enquirySchema>

export function ChatEnquiryForm({ target }: { target: ChatEnquiryTarget }) {
  const formId = useId()
  const [values, setValues] = useState<Record<Field, string>>({
    name: '',
    email: '',
    phone: '',
    message: target.propertyTitle
      ? `I'm interested in ${target.propertyTitle}. Please get in touch.`
      : "I'd like to speak with a property advisor.",
  })
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  )
  const [submitError, setSubmitError] = useState('')

  function update(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: '' }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = enquirySchema.safeParse({
      ...values,
      email: values.email.trim(),
    })
    if (!parsed.success) {
      const fieldErrors: Partial<Record<Field, string>> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field
        fieldErrors[field] ??= issue.message
      }
      setErrors(fieldErrors)
      const first = Object.keys(fieldErrors)[0]
      document.getElementById(`${formId}-${first}`)?.focus()
      return
    }
    setStatus('sending')
    setSubmitError('')
    try {
      await createEnquiry({
        property_id: target.propertyId,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        message: parsed.data.message,
      })
      setStatus('sent')
    } catch (error) {
      setSubmitError(getErrorMessage(error))
      setStatus('error')
    }
  }

  if (status === 'sent')
    return (
      <div className="chat-enquiry chat-enquiry-sent" role="status">
        <CheckCircle2 aria-hidden="true" />
        <div>
          <strong>Enquiry sent.</strong>
          <p>
            Thank you, {values.name.trim()}. A property advisor will contact you
            at {values.email.trim()}
            {target.propertyTitle ? ` about ${target.propertyTitle}` : ''}.
          </p>
        </div>
      </div>
    )

  const field = (name: Field) => ({
    id: `${formId}-${name}`,
    name,
    value: values[name],
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${formId}-${name}-error` : undefined,
  })
  const error = (name: Field) =>
    errors[name] ? (
      <span className="chat-field-error" id={`${formId}-${name}-error`}>
        {errors[name]}
      </span>
    ) : null

  return (
    <form
      className="chat-enquiry"
      onSubmit={submit}
      noValidate
      aria-label={
        target.propertyTitle
          ? `Enquiry about ${target.propertyTitle}`
          : 'Enquiry form'
      }
    >
      <p className="chat-enquiry-title">
        {target.propertyTitle
          ? `Enquire about ${target.propertyTitle}`
          : 'Contact a property advisor'}
      </p>
      <label htmlFor={`${formId}-name`}>Name</label>
      <input
        {...field('name')}
        autoComplete="name"
        onChange={(e) => update('name', e.target.value)}
      />
      {error('name')}
      <label htmlFor={`${formId}-email`}>Email</label>
      <input
        {...field('email')}
        type="email"
        autoComplete="email"
        onChange={(e) => update('email', e.target.value)}
      />
      {error('email')}
      <label htmlFor={`${formId}-phone`}>
        Phone <small>(optional)</small>
      </label>
      <input
        {...field('phone')}
        type="tel"
        autoComplete="tel"
        onChange={(e) => update('phone', e.target.value)}
      />
      {error('phone')}
      <label htmlFor={`${formId}-message`}>Message</label>
      <textarea
        {...field('message')}
        rows={3}
        onChange={(e) => update('message', e.target.value)}
      />
      {error('message')}
      {status === 'error' && (
        <p className="chat-field-error" role="alert">
          {submitError} You can try sending it again.
        </p>
      )}
      <Button
        type="submit"
        className="chat-primary"
        loading={status === 'sending'}
      >
        {status === 'error' ? 'Try again' : 'Send enquiry'}
      </Button>
    </form>
  )
}
