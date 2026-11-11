import { useEffect, useState } from 'react'
import type { ChangeEvent, ComponentProps } from 'react'
import { DatePicker } from '@/components/DatePicker'
import { TimePicker } from '@/components/TimePicker'
import { FormFieldError, useFormControl } from '@/components/ValidatedForm'

// Keep existing input props and change handlers while replacing browser pickers.
export const FormInput = ({ ref: externalRef, id, ...props }: ComponentProps<'input'>) => {
  const field = useFormControl<HTMLInputElement>(externalRef, id)
  const [internalValue, setInternalValue] = useState(String(props.defaultValue || ''))
  const value = props.value === undefined ? internalValue : String(props.value ?? '')
  const [draftDate, setDraftDate] = useState(value.split('T')[0] || '')
  const [draftTime, setDraftTime] = useState(value.split('T')[1] || '')
  useEffect(() => {
    if (props.type !== 'datetime-local') return
    setDraftDate(value.split('T')[0] || '')
    setDraftTime(value.split('T')[1] || '')
  }, [value, props.type])

  const describedBy = [props['aria-describedby'], field.error?.id].filter(Boolean).join(' ') || undefined
  if (!['date', 'time', 'datetime-local', 'month'].includes(props.type || '')) {
    return <><input {...props} id={field.id} ref={field.ref} className={`${props.className || ''}${field.error ? ' ring-1 ring-rose-400' : ''}`} aria-invalid={field.error ? true : props['aria-invalid']} aria-describedby={describedBy} /><FormFieldError error={field.error} /></>
  }

  const changeValue = (next: string) => {
    const input = field.controlRef.current
    if (!input) return
    input.value = next
    if (props.value === undefined) setInternalValue(next)
    props.onChange?.({ target: input, currentTarget: input, type: 'change', nativeEvent: new Event('change'), preventDefault() {}, stopPropagation() {} } as ChangeEvent<HTMLInputElement>)
  }
  const disabled = props.disabled || props.readOnly
  const label = props['aria-label'] || props.placeholder || (props.type === 'time' ? 'Time' : props.type === 'month' ? 'Month' : 'Date')
  const layout = (props.className || '').split(/\s+/).filter(token => /^(?:(?:sm|md|lg|xl):)?(?:w-|min-w-|max-w-|col-span-|flex-|grow|shrink|mt-|mb-)/.test(token)).join(' ')
  const minDate = props.min === undefined ? undefined : String(props.min).split('T')[0]
  const maxDate = props.max === undefined ? undefined : String(props.max).split('T')[0]

  return (
    <div className={layout || 'w-full'}>
      <input {...props} id={`${field.id}-value`} ref={field.ref} value={value} defaultValue={undefined} readOnly={props.readOnly} hidden style={{ ...props.style, display: 'none' }} aria-hidden="true" tabIndex={-1} data-validation-focus={field.id} />
      {props.type === 'time' ? (
        <TimePicker id={field.id} value={value} label={label} onChange={changeValue} disabled={disabled} error={field.error?.message} ariaDescribedBy={props['aria-describedby']} />
      ) : props.type === 'month' ? (
        <DatePicker id={field.id} value={value ? `${value}-01` : ''} onChange={next => changeValue(next.slice(0, 7))} portal clearable size="dense" disabled={disabled} minDate={minDate ? `${minDate}-01` : undefined} maxDate={maxDate ? `${maxDate}-31` : undefined} selectionMode="month" formatDisplay="month" ariaLabel={label} ariaDescribedBy={props['aria-describedby']} error={field.error?.message} inputClassName={props.className} />
      ) : props.type === 'date' ? (
        <DatePicker id={field.id} value={value} onChange={changeValue} portal clearable size="dense" disabled={disabled} minDate={minDate} maxDate={maxDate} ariaLabel={label} ariaDescribedBy={props['aria-describedby']} error={field.error?.message} inputClassName={props.className} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <DatePicker id={field.id} value={draftDate} onChange={next => {
            setDraftDate(next)
            changeValue(next && draftTime ? `${next}T${draftTime}` : '')
          }} portal clearable size="dense" disabled={disabled} minDate={minDate} maxDate={maxDate} ariaLabel={`${label} date`} ariaDescribedBy={props['aria-describedby']} error={field.error?.message} />
          <TimePicker id={`${field.id}-time`} value={draftTime} label={`${label} time`} onChange={next => {
            setDraftTime(next)
            changeValue(draftDate && next ? `${draftDate}T${next}` : '')
          }} disabled={disabled} />
        </div>
      )}
    </div>
  )
}
