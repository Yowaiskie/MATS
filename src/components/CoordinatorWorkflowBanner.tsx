import { useId, useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'

type WorkflowModule = 'schedules' | 'events' | 'attendance'
type WorkflowStepNumber = 1 | 2 | 3

export interface CoordinatorWorkflowBannerProps {
  module: WorkflowModule
  activeStep?: WorkflowStepNumber
  className?: string
}

interface WorkflowStep {
  number: WorkflowStepNumber
  title: string
  description: string
}

const WORKFLOW_STEPS: Record<WorkflowModule, readonly WorkflowStep[]> = {
  schedules: [
    { number: 1, title: 'Create', description: 'Batch monthly Sunday & weekday Masses into a publication.' },
    { number: 2, title: 'Share & Preview', description: 'Preview the portal view and share the intake link with altar servers.' },
    { number: 3, title: 'Review & Finalize', description: 'Verify submitted assignments and finalize the schedule.' }
  ],
  events: [
    { number: 1, title: 'Build Form', description: 'Configure questions, registration limits, and guidelines.' },
    { number: 2, title: 'Share & Preview', description: 'Preview the mobile form view and distribute the RSVP link.' },
    { number: 3, title: 'Roster & Attendance', description: 'Review submitted registrations and track event attendance.' }
  ],
  attendance: [
    { number: 1, title: 'Roster', description: 'Review scheduled servers and verify filed excuse requests.' },
    { number: 2, title: 'Mark Presence', description: 'Log servers as Present, Late, or Excused during service.' },
    { number: 3, title: 'Finalize & Report', description: 'Lock session and generate parish community report.' }
  ]
}

export const CoordinatorWorkflowBanner = ({
  module,
  activeStep,
  className = ''
}: CoordinatorWorkflowBannerProps) => {
  const guideId = useId()
  const [collapsedModules, setCollapsedModules] = useState<Record<WorkflowModule, boolean>>({
    schedules: false,
    events: false,
    attendance: false
  })
  const collapsed = collapsedModules[module]

  return (
    <section aria-labelledby={`${guideId}-title`} className={className}>
      <Card className="p-3! sm:p-4! bg-slate-50/70!">
        <div className="flex items-center justify-between gap-2">
          <h3 id={`${guideId}-title`} className="text-xs font-extrabold text-slate-700">
            Coordinator Guide
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="public"
            className="shrink-0 min-h-11 min-w-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            aria-expanded={!collapsed}
            aria-controls={`${guideId}-steps`}
            onClick={() => setCollapsedModules(previous => ({ ...previous, [module]: !previous[module] }))}
            icon={
              <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={collapsed ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
              </svg>
            }
          >
            {collapsed ? 'Show Guide' : 'Hide Guide'}
          </Button>
        </div>

        <ol id={`${guideId}-steps`} hidden={collapsed} className={collapsed ? '' : 'mt-3 grid grid-cols-1 md:grid-cols-3 gap-4'}>
          {WORKFLOW_STEPS[module].map(step => {
            const isActive = activeStep === step.number
            return (
              <li
                key={step.number}
                aria-current={isActive ? 'step' : undefined}
                className={`rounded-xl p-4 border shadow-2xs ${isActive ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200/60'}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span aria-hidden="true" className={`w-6 h-6 shrink-0 rounded-full font-black text-xs flex items-center justify-center ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {step.number}
                  </span>
                  <h4 className={`text-xs font-bold ${isActive ? 'text-indigo-700' : 'text-slate-800'}`}>
                    <span className="sr-only">Step {step.number}: </span>
                    {step.title}
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
              </li>
            )
          })}
        </ol>
      </Card>
    </section>
  )
}
