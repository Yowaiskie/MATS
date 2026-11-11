import { createContext, useContext, useEffect, useId, useRef, useState, useCallback } from 'react'
import type { ComponentProps, Ref, RefObject } from 'react'

interface FieldError { message: string; id: string }
const FormErrors = createContext<ReadonlyMap<HTMLElement, FieldError>>(new Map())
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

const getMessage = (input: Control) => {
  const label = input.labels?.[0]?.textContent || input.parentElement?.querySelector('label')?.textContent
    || (input.hasAttribute('data-validation-focus') ? input.parentElement?.parentElement?.querySelector('label')?.textContent : undefined)
  const name = (label || input.getAttribute('aria-label') || 'This field').replace(/\*/g, '').trim()
  const validity = input.validity
  if (validity.valueMissing) return `${name} is required.`
  if (validity.typeMismatch) return input.type === 'email' ? 'Enter a valid email address.' : 'Enter a valid URL.'
  if (validity.rangeUnderflow) return input.type === 'number' ? `Enter a value of at least ${input.getAttribute('min')}.` : `Choose ${input.getAttribute('min')} or later.`
  if (validity.rangeOverflow) return input.type === 'number' ? `Enter a value of at most ${input.getAttribute('max')}.` : `Choose ${input.getAttribute('max')} or earlier.`
  if (validity.tooShort) return `Enter at least ${input.getAttribute('minlength')} characters.`
  if (validity.tooLong) return `Enter no more than ${input.getAttribute('maxlength')} characters.`
  if (validity.patternMismatch) return input.title || 'Use the requested format.'
  if (validity.stepMismatch) return 'Choose a value matching the allowed interval.'
  if (validity.badInput) return 'Enter a complete, valid value.'
  return input.validationMessage || 'Check this value.'
}

export const ValidatedForm = ({ children, onSubmit, noValidate, ref: externalRef, ...props }: ComponentProps<'form'>) => {
  const { ref } = useFormControl<HTMLFormElement>(externalRef)
  const [errors, setErrors] = useState<ReadonlyMap<HTMLElement, FieldError>>(new Map())
  const formId = useId()

  // Remove corrected errors, including controlled picker updates and removed rows.
  useEffect(() => {
    if (!errors.size) return
    const next = new Map(errors)
    let changed = false
    for (const [input, error] of next) {
      if (!input.isConnected || !(input as Control).willValidate || (input as Control).validity.valid) next.delete(input)
      else {
        const message = getMessage(input as Control)
        if (message !== error.message) {
          next.set(input, { ...error, message })
          changed = true
        }
      }
    }
    if (changed || next.size !== errors.size) setErrors(next)
  })

  return (
    <FormErrors.Provider value={errors}>
      <form {...props} ref={ref} noValidate onSubmit={event => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | HTMLInputElement | null
        // Forms already using manual validation keep their existing handlers.
        if (!noValidate && !submitter?.formNoValidate) {
          const next = new Map<HTMLElement, FieldError>()
          for (const element of Array.from(event.currentTarget.elements)) {
            if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) continue
            if (element.willValidate && !element.validity.valid) {
              next.set(element, { message: getMessage(element), id: `${formId}-error-${next.size}` })
            }
          }
          setErrors(next)
          if (next.size) {
            event.preventDefault()
            const first = next.keys().next().value
            const focusId = first?.getAttribute('data-validation-focus')
            const target = focusId ? document.getElementById(focusId) : first
            target?.focus()
            target?.scrollIntoView({ block: 'nearest' })
            return
          }
        }
        onSubmit?.(event)
      }}>
        {children}
      </form>
    </FormErrors.Provider>
  )
}

export const useFormControl = <T extends HTMLElement>(externalRef?: Ref<T>, id?: string) => {
  const controlRef = useRef<T | null>(null)
  const generatedId = useId()
  const errors = useContext(FormErrors)
  const error = controlRef.current ? errors.get(controlRef.current) : undefined
  const ref = useCallback((node: T | null) => {
    controlRef.current = node
    if (typeof externalRef === 'function') externalRef(node)
    else if (externalRef) (externalRef as RefObject<T | null>).current = node
  }, [externalRef])
  return { ref, controlRef, id: id || generatedId, error }
}

export const FormFieldError = ({ error }: { error?: FieldError }) => error
  ? <p id={error.id} className="mt-1 text-xs font-semibold text-rose-600" role="alert">{error.message}</p>
  : null

export const FormTextarea = ({ ref: externalRef, id, ...props }: ComponentProps<'textarea'>) => {
  const field = useFormControl<HTMLTextAreaElement>(externalRef, id)
  return <><textarea {...props} id={field.id} ref={field.ref} className={`${props.className || ''}${field.error ? ' ring-1 ring-rose-400' : ''}`} aria-invalid={field.error ? true : props['aria-invalid']} aria-describedby={[props['aria-describedby'], field.error?.id].filter(Boolean).join(' ') || undefined} /><FormFieldError error={field.error} /></>
}
