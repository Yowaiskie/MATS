import { FormInput } from '@/components/FormInput'
import { CustomSelect } from '@/components'
import type { Priority, TaskStatus } from '@/types/event'

interface TaskDetailsFieldsProps {
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  startDate: string
  dueDate: string
  canEdit: boolean
  submitting: boolean
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onStatusChange: (value: TaskStatus) => void
  onPriorityChange: (value: Priority) => void
  onStartDateChange: (value: string) => void
  onDueDateChange: (value: string) => void
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'Not Started', label: 'To Do' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Waiting', label: 'Waiting' },
  { value: 'Completed', label: 'Completed' }
]

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
  { value: 'Critical', label: 'Critical' }
]

export const TaskDetailsFields = ({
  title,
  description,
  status,
  priority,
  startDate,
  dueDate,
  canEdit,
  submitting,
  onTitleChange,
  onDescriptionChange,
  onStatusChange,
  onPriorityChange,
  onStartDateChange,
  onDueDateChange,
}: TaskDetailsFieldsProps) => {
  return (
    <>
      <div>
        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Task Title *</label>
        <FormInput type="text" value={title} onChange={(e) => onTitleChange(e.target.value)} disabled={!canEdit || submitting} className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400 shadow-2xs" placeholder="e.g. Coordinate venue setup and logistics" required />
      </div>

      <div>
        <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Description</label>
        <textarea value={description} onChange={(e) => onDescriptionChange(e.target.value)} disabled={!canEdit || submitting} rows={3} className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none disabled:bg-slate-50 disabled:text-slate-400 shadow-2xs" placeholder="Task details and instructions..." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <CustomSelect
            label="Status"
            id="task-status-select"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
            disabled={!canEdit || submitting}
          />
        </div>
        <div>
          <CustomSelect
            label="Priority"
            id="task-priority-select"
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value as Priority)}
            disabled={!canEdit || submitting}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
          <FormInput type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} disabled={!canEdit || submitting} className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400 shadow-2xs" />
        </div>
        <div>
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Due Date</label>
          <FormInput type="date" value={dueDate} onChange={(e) => onDueDateChange(e.target.value)} disabled={!canEdit || submitting} className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400 shadow-2xs" />
        </div>
      </div>
    </>
  )
}
