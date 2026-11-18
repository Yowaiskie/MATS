import React, { useState, useMemo } from 'react'
import type { EventFormQuestion, EventFormResponse } from '@/types/eventForm'
import type { Member } from '@/types/member'
import { ActionMenu } from '@/components'

interface EvaluationCollapsibleViewProps {
  questions: EventFormQuestion[]
  responses: EventFormResponse[]
  membersList: Member[]
  membersMap: Record<string, string>
  eligibleMembersList: Member[]
  searchTerm: string
  orderFilter: string
  activeTab: 'responded' | 'pending' | 'all'
  formatQuestionAnswer: (q: EventFormQuestion, val: any) => string
  onSelectResponse: (r: EventFormResponse) => void
  onEditResponse: (r: EventFormResponse) => void
  onDeleteResponse: (r: EventFormResponse) => void
  renderTableView?: () => React.ReactNode
}

interface EvaluatedMemberInfo {
  id: string
  name: string
  order: string
  rank: string
}

interface ScoreSummary {
  totalRating: number
  answeredCount: number
  maxPossible: number
  average: number
  percentage: number
}

interface EvaluatedItem {
  response: EventFormResponse
  evaluatedMember: EvaluatedMemberInfo
  score: ScoreSummary
  submittedAtFormatted: string
  recommendation?: string
}

interface EvaluatorGroup {
  key: string
  name: string
  email: string
  uid: string
  evaluations: EvaluatedItem[]
  overallAvg: number
  totalEvaluations: number
  latestSubmission: string
}

interface MemberGroup {
  key: string
  member: EvaluatedMemberInfo
  evaluations: Array<{
    response: EventFormResponse
    evaluatorName: string
    evaluatorEmail: string
    score: ScoreSummary
    submittedAtFormatted: string
    recommendation?: string
  }>
  overallAvg: number
  totalEvaluations: number
  latestSubmission: string
}

export const EvaluationCollapsibleView: React.FC<EvaluationCollapsibleViewProps> = ({
  questions,
  responses,
  membersList,
  membersMap,
  eligibleMembersList,
  searchTerm,
  orderFilter,
  activeTab,
  formatQuestionAnswer,
  onSelectResponse,
  onEditResponse,
  onDeleteResponse,
  renderTableView
}) => {
  // View mode: 'evaluator' (default), 'member', or 'table'
  const [viewMode, setViewMode] = useState<'evaluator' | 'member' | 'table'>('evaluator')

  // Expanded states
  const [expandedEvaluators, setExpandedEvaluators] = useState<Record<string, boolean>>({})
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({})
  const [expandedResponseAnswers, setExpandedResponseAnswers] = useState<Record<string, boolean>>({})

  // Find member selector question
  const memberSelectorQ = useMemo(() => {
    return questions.find(q => q.type === 'member_selector')
  }, [questions])

  // Extract rating questions
  const ratingQuestions = useMemo(() => {
    return questions.filter(q => q.type === 'rating')
  }, [questions])

  // Compute score summary for a single response
  const computeScore = (r: EventFormResponse): ScoreSummary => {
    let totalRating = 0
    let answeredCount = 0
    let maxPossible = 0

    ratingQuestions.forEach(q => {
      const val = r.answers?.[q.id]
      if (val !== undefined && val !== null && val !== '') {
        const num = Number(val)
        if (!isNaN(num) && num > 0) {
          totalRating += num
          answeredCount++
          maxPossible += (q.maxRating || 5)
        }
      }
    })

    const average = answeredCount > 0 ? Number((totalRating / answeredCount).toFixed(1)) : 0
    const percentage = maxPossible > 0 ? Math.round((totalRating / maxPossible) * 100) : 0

    return {
      totalRating,
      answeredCount,
      maxPossible,
      average,
      percentage
    }
  }

  // Resolve evaluated member details
  const getEvaluatedMember = (r: EventFormResponse): EvaluatedMemberInfo => {
    if (!memberSelectorQ) {
      return {
        id: r.respondentMemberUid || '',
        name: r.respondentMemberName || 'Unknown Member',
        order: '',
        rank: ''
      }
    }

    const rawVal = r.answers?.[memberSelectorQ.id]
    if (!rawVal) {
      return {
        id: '',
        name: 'Unspecified Member',
        order: '',
        rank: ''
      }
    }

    const matched = membersList.find(m => m.id === rawVal || `${m.lastName}, ${m.firstName}` === rawVal)
    if (matched) {
      return {
        id: matched.id,
        name: `${matched.lastName}, ${matched.firstName}`,
        order: matched.order || '',
        rank: matched.rank || ''
      }
    }

    const mapped = membersMap[String(rawVal)]
    if (mapped) {
      return {
        id: String(rawVal),
        name: mapped,
        order: '',
        rank: ''
      }
    }

    return {
      id: String(rawVal),
      name: String(rawVal),
      order: '',
      rank: ''
    }
  }

  // Format submission date
  const formatSubmittedDate = (submittedAt: any): string => {
    if (submittedAt && typeof submittedAt === 'object' && 'seconds' in submittedAt) {
      return new Date(submittedAt.seconds * 1000).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }
    return String(submittedAt || '-')
  }

  // Find officer recommendation answer if present
  const getRecommendation = (r: EventFormResponse): string | undefined => {
    const recQ = questions.find(q =>
      q.question.toLowerCase().includes('recommendation') ||
      q.question.toLowerCase().includes('rekomendasyon')
    )
    if (recQ && r.answers?.[recQ.id]) {
      return String(r.answers[recQ.id])
    }
    return undefined
  }

  // Group by Evaluator (Officer)
  const allEvaluatorGroups = useMemo<EvaluatorGroup[]>(() => {
    const map = new Map<string, EvaluatorGroup>()

    responses.forEach(r => {
      const name = r.respondentMemberName?.trim() || r.respondentEmail?.trim() || 'Officer / Evaluator'
      const email = r.respondentEmail || ''
      const uid = r.respondentMemberUid || ''
      const key = (name + '::' + email).toLowerCase()

      const evaluatedMember = getEvaluatedMember(r)
      const score = computeScore(r)
      const submittedAtFormatted = formatSubmittedDate(r.submittedAt)
      const recommendation = getRecommendation(r)

      if (!map.has(key)) {
        map.set(key, {
          key,
          name,
          email,
          uid,
          evaluations: [],
          overallAvg: 0,
          totalEvaluations: 0,
          latestSubmission: submittedAtFormatted
        })
      }

      const group = map.get(key)!
      group.evaluations.push({
        response: r,
        evaluatedMember,
        score,
        submittedAtFormatted,
        recommendation
      })
    })

    return Array.from(map.values()).map(g => {
      const scored = g.evaluations.filter(e => e.score.answeredCount > 0)
      const overallAvg = scored.length > 0
        ? Number((scored.reduce((sum, e) => sum + e.score.average, 0) / scored.length).toFixed(1))
        : 0

      return {
        ...g,
        totalEvaluations: g.evaluations.length,
        overallAvg
      }
    }).sort((a, b) => b.totalEvaluations - a.totalEvaluations)
  }, [responses, questions, membersList, membersMap, memberSelectorQ, ratingQuestions])

  // Filtered evaluator groups based on search term & order filter
  const filteredEvaluatorGroups = useMemo<EvaluatorGroup[]>(() => {
    const term = searchTerm.toLowerCase().trim()

    return allEvaluatorGroups.map(group => {
      const matchingEvaluations = group.evaluations.filter(e => {
        // Order filter
        if (orderFilter !== 'all') {
          const memOrder = e.evaluatedMember.order.toLowerCase()
          if (!memOrder.includes(orderFilter.toLowerCase())) {
            return false
          }
        }

        // Search term filter
        if (!term) return true

        const evaluatorMatch = group.name.toLowerCase().includes(term) || group.email.toLowerCase().includes(term)
        const memberMatch = e.evaluatedMember.name.toLowerCase().includes(term) ||
                            e.evaluatedMember.order.toLowerCase().includes(term) ||
                            e.evaluatedMember.rank.toLowerCase().includes(term)
        const answerMatch = Object.values(e.response.answers || {}).some(val =>
          String(val).toLowerCase().includes(term)
        )

        return evaluatorMatch || memberMatch || answerMatch
      })

      return {
        ...group,
        evaluations: matchingEvaluations
      }
    }).filter(group => group.evaluations.length > 0)
  }, [allEvaluatorGroups, searchTerm, orderFilter])

  // Group by Evaluated Member
  const allMemberGroups = useMemo<MemberGroup[]>(() => {
    const map = new Map<string, MemberGroup>()

    responses.forEach(r => {
      const evaluatedMember = getEvaluatedMember(r)
      const key = (evaluatedMember.id || evaluatedMember.name).toLowerCase()
      const score = computeScore(r)
      const submittedAtFormatted = formatSubmittedDate(r.submittedAt)
      const recommendation = getRecommendation(r)
      const evaluatorName = r.respondentMemberName?.trim() || r.respondentEmail?.trim() || 'Officer / Evaluator'
      const evaluatorEmail = r.respondentEmail || ''

      if (!map.has(key)) {
        map.set(key, {
          key,
          member: evaluatedMember,
          evaluations: [],
          overallAvg: 0,
          totalEvaluations: 0,
          latestSubmission: submittedAtFormatted
        })
      }

      const group = map.get(key)!
      group.evaluations.push({
        response: r,
        evaluatorName,
        evaluatorEmail,
        score,
        submittedAtFormatted,
        recommendation
      })
    })

    return Array.from(map.values()).map(g => {
      const scored = g.evaluations.filter(e => e.score.answeredCount > 0)
      const overallAvg = scored.length > 0
        ? Number((scored.reduce((sum, e) => sum + e.score.average, 0) / scored.length).toFixed(1))
        : 0

      return {
        ...g,
        totalEvaluations: g.evaluations.length,
        overallAvg
      }
    }).sort((a, b) => a.member.name.localeCompare(b.member.name))
  }, [responses, questions, membersList, membersMap, memberSelectorQ, ratingQuestions])

  // Filtered member groups
  const filteredMemberGroups = useMemo<MemberGroup[]>(() => {
    const term = searchTerm.toLowerCase().trim()

    return allMemberGroups.filter(g => {
      if (orderFilter !== 'all') {
        const memOrder = g.member.order.toLowerCase()
        if (!memOrder.includes(orderFilter.toLowerCase())) {
          return false
        }
      }

      if (!term) return true

      const nameMatch = g.member.name.toLowerCase().includes(term) ||
                        g.member.order.toLowerCase().includes(term) ||
                        g.member.rank.toLowerCase().includes(term)
      const evaluatorMatch = g.evaluations.some(e =>
        e.evaluatorName.toLowerCase().includes(term) || e.evaluatorEmail.toLowerCase().includes(term)
      )
      const answerMatch = g.evaluations.some(e =>
        Object.values(e.response.answers || {}).some(val => String(val).toLowerCase().includes(term))
      )

      return nameMatch || evaluatorMatch || answerMatch
    })
  }, [allMemberGroups, searchTerm, orderFilter])

  // Evaluated member IDs set for pending evaluation calculation
  const evaluatedMemberIdsSet = useMemo(() => {
    const set = new Set<string>()
    responses.forEach(r => {
      if (memberSelectorQ) {
        const val = r.answers?.[memberSelectorQ.id]
        if (typeof val === 'string' && val) set.add(val)
      }
    })
    return set
  }, [responses, memberSelectorQ])

  // Pending members who have not received any evaluations
  const pendingMembersList = useMemo(() => {
    return eligibleMembersList.filter(m => {
      const fullName = `${m.lastName}, ${m.firstName}`
      return !evaluatedMemberIdsSet.has(m.id) && !evaluatedMemberIdsSet.has(fullName)
    })
  }, [eligibleMembersList, evaluatedMemberIdsSet])

  // Toggle handlers
  const toggleEvaluator = (key: string) => {
    setExpandedEvaluators(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleMember = (key: string) => {
    setExpandedMembers(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleResponseAnswers = (responseId: string) => {
    setExpandedResponseAnswers(prev => ({ ...prev, [responseId]: !prev[responseId] }))
  }

  const handleExpandAll = () => {
    if (viewMode === 'evaluator') {
      const nextEvaluators: Record<string, boolean> = {}
      const nextAnswers: Record<string, boolean> = {}
      allEvaluatorGroups.forEach(g => {
        nextEvaluators[g.key] = true
        g.evaluations.forEach(e => {
          if (e.response.id) nextAnswers[e.response.id] = true
        })
      })
      setExpandedEvaluators(nextEvaluators)
      setExpandedResponseAnswers(nextAnswers)
    } else if (viewMode === 'member') {
      const nextMembers: Record<string, boolean> = {}
      const nextAnswers: Record<string, boolean> = {}
      allMemberGroups.forEach(g => {
        nextMembers[g.key] = true
        g.evaluations.forEach(e => {
          if (e.response.id) nextAnswers[e.response.id] = true
        })
      })
      setExpandedMembers(nextMembers)
      setExpandedResponseAnswers(nextAnswers)
    }
  }

  const handleCollapseAll = () => {
    setExpandedEvaluators({})
    setExpandedMembers({})
    setExpandedResponseAnswers({})
  }

  // Filter out selector and section header questions for evaluation breakdown
  const evaluationQuestions = useMemo(() => {
    return questions.filter(q => q.type !== 'member_selector' && q.type !== 'section_header')
  }, [questions])

  const rubricQuestions = useMemo(() => {
    return evaluationQuestions.filter(q => q.type === 'rating')
  }, [evaluationQuestions])

  const narrativeQuestions = useMemo(() => {
    return evaluationQuestions.filter(q => q.type === 'long_text' || q.type === 'short_text')
  }, [evaluationQuestions])

  const otherQuestions = useMemo(() => {
    return evaluationQuestions.filter(q => q.type !== 'rating' && q.type !== 'long_text' && q.type !== 'short_text')
  }, [evaluationQuestions])

  // Render question answers card (Level 3 collapsible)
  const renderEvaluationAnswers = (r: EventFormResponse) => {
    return (
      <div className="p-3.5 sm:p-4 bg-slate-50/90 border-t border-slate-200/80 rounded-b-xl space-y-4 animate-in fade-in duration-150">
        {/* Rubric Star Ratings */}
        {rubricQuestions.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
                <span>Performance & Rubric Ratings ({rubricQuestions.length} criteria)</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {rubricQuestions.map((q, qIdx) => {
                const val = r.answers?.[q.id]
                const scoreNum = Number(val)
                const maxRating = q.maxRating || 5
                const hasScore = !isNaN(scoreNum) && scoreNum > 0

                return (
                  <div
                    key={q.id}
                    className="p-2.5 sm:p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5 flex flex-col justify-between"
                  >
                    <div className="text-xs font-bold text-slate-800 leading-snug">
                      <span className="text-slate-400 font-mono mr-1">#{qIdx + 1}</span>
                      {q.question}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      {hasScore ? (
                        <>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: maxRating }, (_, i) => (
                              <svg
                                key={i}
                                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                                  i < scoreNum
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-slate-200 fill-slate-200'
                                }`}
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                              </svg>
                            ))}
                          </div>
                          <span className="text-xs font-black text-slate-800 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-lg">
                            {scoreNum} / {maxRating}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not rated</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Narrative Feedback & Remarks */}
        {narrativeQuestions.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-slate-200/60">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span>Officer Narrative & Remarks</span>
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {narrativeQuestions.map(q => {
                const val = r.answers?.[q.id]
                return (
                  <div key={q.id} className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      {q.question}
                    </span>
                    <p className="text-xs font-medium text-slate-800 italic bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 whitespace-pre-wrap leading-relaxed">
                      {val ? `"${val}"` : <span className="text-slate-400 not-italic">No feedback provided</span>}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recommendations and Other Question Types */}
        {otherQuestions.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-slate-200/60">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
              Recommendations & Form Questions
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {otherQuestions.map(q => {
                const val = r.answers?.[q.id]
                const displayVal = formatQuestionAnswer(q, val)
                return (
                  <div key={q.id} className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate" title={q.question}>
                      {q.question}
                    </span>
                    <span className="text-xs font-bold text-slate-800 block break-words">
                      {displayVal}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* View Mode Bar & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Layout:
          </span>
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('evaluator')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'evaluator'
                  ? 'bg-white text-indigo-700 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>By Evaluator (Collapsible)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('member')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'member'
                  ? 'bg-white text-indigo-700 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>By Evaluated Member</span>
            </button>
            {renderTableView && (
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'table'
                    ? 'bg-white text-indigo-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Table View</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Controls */}
        {viewMode !== 'table' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExpandAll}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:text-indigo-700 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-xl transition cursor-pointer"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:text-indigo-700 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-xl transition cursor-pointer"
            >
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* When active tab is Pending (Not Yet Answered) */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                Target Members Pending Evaluation ({pendingMembersList.length})
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Members in the target roster who have not received an evaluation yet.
              </p>
            </div>
            <span className="px-2.5 py-1 text-xs font-black bg-amber-200/80 text-amber-900 rounded-lg">
              {pendingMembersList.length} Pending
            </span>
          </div>

          {pendingMembersList.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200">
              <span className="text-3xl block mb-2">🎉</span>
              <h4 className="text-sm font-black text-slate-900">All Target Members Evaluated</h4>
              <p className="text-xs text-slate-500 mt-1">Every eligible member has at least one submitted evaluation.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {pendingMembersList.map(m => (
                <div key={m.id} className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-bold text-slate-900 truncate">
                      {m.lastName}, {m.firstName}
                    </h5>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                      {m.order && <span>{m.order}</span>}
                      {m.order && m.rank && <span>•</span>}
                      {m.rank && <span className="font-semibold text-amber-700">{m.rank}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main View: By Evaluator */}
      {activeTab !== 'pending' && viewMode === 'evaluator' && (
        filteredEvaluatorGroups.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
            <p className="text-sm font-bold">No evaluations found</p>
            <p className="text-xs mt-1 text-slate-400">Try adjusting your search keywords or order filter.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredEvaluatorGroups.map(group => {
              // Default to expanded for clear initial visibility
              const isEvaluatorOpen = expandedEvaluators[group.key] ?? true

              return (
                <div
                  key={group.key}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all duration-200"
                >
                  {/* Level 1: Evaluator Header */}
                  <div
                    onClick={() => toggleEvaluator(group.key)}
                    className="p-3.5 sm:p-4 bg-linear-to-r from-slate-50 to-white hover:from-indigo-50/30 hover:to-white border-b border-slate-100 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                          {group.name}
                        </h3>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                          Evaluating Officer
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5 font-medium">
                        {group.email && <span className="truncate max-w-[200px]">{group.email}</span>}
                        {group.email && <span>•</span>}
                        <span className="font-semibold text-slate-700">
                          {group.evaluations.length} {group.evaluations.length === 1 ? 'member' : 'members'} evaluated
                        </span>
                        {group.latestSubmission && (
                          <>
                            <span className="hidden sm:inline">•</span>
                            <span className="text-[11px] text-slate-400 hidden sm:inline">Latest: {group.latestSubmission}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                      {group.overallAvg > 0 && (
                        <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                          <span className="text-amber-500">★</span>
                          <span>{group.overallAvg} / 5 Avg</span>
                        </span>
                      )}
                      <span className="px-2.5 py-1 text-xs font-black text-indigo-700 bg-indigo-50 rounded-xl border border-indigo-100 font-mono">
                        {group.evaluations.length} Evaluated
                      </span>
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 transition-transform duration-200 ${
                          isEvaluatorOpen ? 'rotate-180' : ''
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Level 1 Body: Evaluated Members List ("unang collapsible sino na evaluate niya") */}
                  {isEvaluatorOpen && (
                    <div className="p-3 sm:p-4 bg-slate-50/50 space-y-2.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 flex items-center justify-between">
                        <span>Evaluated Members ({group.evaluations.length})</span>
                        <span className="text-[10px] text-slate-400 font-normal">Click member to expand answers</span>
                      </div>

                      {group.evaluations.map(item => {
                        const isAnswersOpen = expandedResponseAnswers[item.response.id || ''] ?? false

                        return (
                          <div
                            key={item.response.id}
                            className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all duration-150"
                          >
                            {/* Level 2: Evaluated Member Row */}
                            <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div
                                onClick={() => toggleResponseAnswers(item.response.id || '')}
                                className="min-w-0 flex-1 cursor-pointer select-none"
                              >
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                    {item.evaluatedMember.name}
                                  </h4>
                                  {item.evaluatedMember.order && (
                                    <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                      {item.evaluatedMember.order}
                                    </span>
                                  )}
                                  {item.evaluatedMember.rank && (
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                      {item.evaluatedMember.rank}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                  <span>Submitted {item.submittedAtFormatted}</span>
                                  {item.recommendation && (
                                    <>
                                      <span>•</span>
                                      <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                        {item.recommendation}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Level 2 Right: Score, Action Menu, and View Answers Button */}
                              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                {item.score.answeredCount > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                                    <span className="text-amber-500">★</span>
                                    <span>{item.score.average} / 5</span>
                                    <span className="text-[10px] font-bold text-amber-600">({item.score.percentage}%)</span>
                                  </span>
                                )}

                                <ActionMenu
                                  triggerVariant="meatball"
                                  tooltip="Response Options"
                                  size="xs"
                                  items={[
                                    {
                                      label: 'View Full Details',
                                      icon: (
                                        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                      ),
                                      onClick: () => onSelectResponse(item.response)
                                    },
                                    {
                                      label: 'Edit Response',
                                      icon: (
                                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      ),
                                      onClick: () => onEditResponse(item.response)
                                    },
                                    {
                                      label: 'Delete Response',
                                      variant: 'danger',
                                      icon: (
                                        <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      ),
                                      onClick: () => onDeleteResponse(item.response)
                                    }
                                  ]}
                                />

                                {/* 2nd Collapsible Trigger: "2nd yung mga sagot na sa evaluation" */}
                                <button
                                  type="button"
                                  onClick={() => toggleResponseAnswers(item.response.id || '')}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                    isAnswersOpen
                                      ? 'bg-indigo-600 text-white shadow-2xs'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  <span>{isAnswersOpen ? 'Hide Answers' : 'View Answers'}</span>
                                  <svg
                                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isAnswersOpen ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Level 3: The 2nd Collapsible Content */}
                            {isAnswersOpen && renderEvaluationAnswers(item.response)}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Main View: By Evaluated Member */}
      {activeTab !== 'pending' && viewMode === 'member' && (
        filteredMemberGroups.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
            <p className="text-sm font-bold">No members found</p>
            <p className="text-xs mt-1 text-slate-400">Try adjusting your search keywords or order filter.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredMemberGroups.map(group => {
              const isMemberOpen = expandedMembers[group.key] ?? true

              return (
                <div
                  key={group.key}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all duration-200"
                >
                  {/* Member Header */}
                  <div
                    onClick={() => toggleMember(group.key)}
                    className="p-3.5 sm:p-4 bg-linear-to-r from-slate-50 to-white hover:from-blue-50/30 hover:to-white border-b border-slate-100 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                          {group.member.name}
                        </h3>
                        {group.member.order && (
                          <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {group.member.order}
                          </span>
                        )}
                        {group.member.rank && (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            {group.member.rank}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5 font-medium">
                        <span>{group.evaluations.length} {group.evaluations.length === 1 ? 'officer evaluated' : 'officers evaluated'}</span>
                        <span>•</span>
                        <span className="text-slate-600">
                          Evaluated by: {group.evaluations.map(e => e.evaluatorName).join(', ')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                      {group.overallAvg > 0 && (
                        <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                          <span className="text-amber-500">★</span>
                          <span>{group.overallAvg} / 5 Combined Avg</span>
                        </span>
                      )}
                      <span className="px-2.5 py-1 text-xs font-black text-blue-700 bg-blue-50 rounded-xl border border-blue-100 font-mono">
                        {group.evaluations.length} Evals
                      </span>
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 transition-transform duration-200 ${
                          isMemberOpen ? 'rotate-180' : ''
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* List of Evaluating Officers */}
                  {isMemberOpen && (
                    <div className="p-3 sm:p-4 bg-slate-50/50 space-y-2.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                        Evaluating Officers ({group.evaluations.length})
                      </div>

                      {group.evaluations.map(item => {
                        const isAnswersOpen = expandedResponseAnswers[item.response.id || ''] ?? false

                        return (
                          <div
                            key={item.response.id}
                            className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all duration-150"
                          >
                            <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div
                                onClick={() => toggleResponseAnswers(item.response.id || '')}
                                className="min-w-0 flex-1 cursor-pointer select-none"
                              >
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                    {item.evaluatorName}
                                  </h4>
                                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                    Evaluating Officer
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                  <span>Submitted {item.submittedAtFormatted}</span>
                                  {item.recommendation && (
                                    <>
                                      <span>•</span>
                                      <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                        {item.recommendation}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                {item.score.answeredCount > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                                    <span className="text-amber-500">★</span>
                                    <span>{item.score.average} / 5</span>
                                  </span>
                                )}

                                <ActionMenu
                                  triggerVariant="meatball"
                                  tooltip="Response Options"
                                  size="xs"
                                  items={[
                                    {
                                      label: 'View Full Details',
                                      icon: (
                                        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                      ),
                                      onClick: () => onSelectResponse(item.response)
                                    },
                                    {
                                      label: 'Edit Response',
                                      icon: (
                                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      ),
                                      onClick: () => onEditResponse(item.response)
                                    },
                                    {
                                      label: 'Delete Response',
                                      variant: 'danger',
                                      icon: (
                                        <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      ),
                                      onClick: () => onDeleteResponse(item.response)
                                    }
                                  ]}
                                />

                                <button
                                  type="button"
                                  onClick={() => toggleResponseAnswers(item.response.id || '')}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                    isAnswersOpen
                                      ? 'bg-indigo-600 text-white shadow-2xs'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  <span>{isAnswersOpen ? 'Hide Answers' : 'View Answers'}</span>
                                  <svg
                                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isAnswersOpen ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {isAnswersOpen && renderEvaluationAnswers(item.response)}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Main View: Flat Table (when selected) */}
      {activeTab !== 'pending' && viewMode === 'table' && renderTableView && renderTableView()}
    </div>
  )
}
