import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'

interface TimePickerProps {
  id: string
  value: string
  onChange: (value: string) => void
  label: string
  disabled?: boolean
  error?: string
  ariaDescribedBy?: string
}

const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))

export const TimePicker = ({ id, value, onChange, label, disabled = false, error, ariaDescribedBy }: TimePickerProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [hour, setHour] = useState('09')
  const [minute, setMinute] = useState('00')
  const [period, setPeriod] = useState('AM')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const errorId = useId()

  const close = useCallback(() => {
    setIsOpen(false)
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (disabled) setIsOpen(false)
  }, [disabled])

  useEffect(() => {
    if (!isOpen) return
    const selected = optionsRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    selected?.focus()
    selected?.scrollIntoView({ block: 'nearest' })
    optionsRef.current?.querySelector<HTMLButtonElement>('[aria-label="Minute"] [aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' })
    const dialog = selected?.closest('[role="dialog"]')
    // Keep keyboard navigation inside the time dialog while it is open.
    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return
      const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [isOpen])

  const open = () => {
    const parts = value.split(':')
    const hours = value ? Number(parts[0]) : 9
    setHour(String(hours % 12 || 12).padStart(2, '0'))
    setMinute(parts[1] || '00')
    setPeriod(hours >= 12 ? 'PM' : 'AM')
    setIsOpen(true)
  }

  const display = value ? `${String(Number(value.split(':')[0]) % 12 || 12).padStart(2, '0')}:${value.split(':')[1]} ${Number(value.split(':')[0]) >= 12 ? 'PM' : 'AM'}` : 'Select time'

  return (
    <div>
      <button ref={triggerRef} id={id} type="button" disabled={disabled} onClick={open}
        aria-label={`${label}: ${display}`} aria-haspopup="dialog" aria-expanded={isOpen}
        aria-invalid={Boolean(error)} aria-describedby={[ariaDescribedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-xl border ${error ? 'border-rose-400' : 'border-slate-200'} bg-white px-3 text-xs font-bold text-slate-900 shadow-2xs outline-none transition hover:bg-slate-50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}>
        <span className={value ? '' : 'text-slate-400'}>{display}</span>
        <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 2" />
        </svg>
      </button>
      {error && <p id={errorId} className="mt-1 text-xs font-semibold text-rose-600">{error}</p>}
      <Modal isOpen={isOpen && !disabled} onClose={close} title={`Select ${label.toLowerCase()}`} maxWidth="sm"
        footer={<>
          <Button type="button" variant="secondary" size="sm" onClick={() => { onChange(''); close() }}>Clear</Button>
          <Button type="button" size="sm" onClick={() => {
            const hours = Number(hour) % 12 + (period === 'PM' ? 12 : 0)
            onChange(`${String(hours).padStart(2, '0')}:${minute}`)
            close()
          }}>Apply Time</Button>
        </>}>
        <div ref={optionsRef} className="grid grid-cols-3 gap-3">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Hour</p>
            <div className="h-40 space-y-1 overflow-y-auto" role="group" aria-label="Hour">
              {HOURS.map(item => <Button key={item} type="button" size="sm" variant={hour === item ? 'primary' : 'secondary'} className="w-full" aria-label={`Hour ${item}`} aria-pressed={hour === item} onClick={() => setHour(item)}>{item}</Button>)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Minute</p>
            <div className="h-40 space-y-1 overflow-y-auto" role="group" aria-label="Minute">
              {MINUTES.map(item => <Button key={item} type="button" size="sm" variant={minute === item ? 'primary' : 'secondary'} className="w-full" aria-label={`Minute ${item}`} aria-pressed={minute === item} onClick={() => setMinute(item)}>{item}</Button>)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">AM / PM</p>
            <div className="space-y-1" role="group" aria-label="AM or PM">
              {['AM', 'PM'].map(item => <Button key={item} type="button" size="sm" variant={period === item ? 'primary' : 'secondary'} className="w-full" aria-pressed={period === item} onClick={() => setPeriod(item)}>{item}</Button>)}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
