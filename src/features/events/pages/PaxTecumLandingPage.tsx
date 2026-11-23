import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { settingsService, type PaxTecumLandingSettings } from '@/services/settingsService'
import { eventFormService } from '@/services/eventFormService'
import { eventFormQuestionService } from '@/services/eventFormQuestionService'
import { eventFormResponseService } from '@/services/eventFormResponseService'
import type { EventForm, EventFormQuestion } from '@/types/eventForm'
import { buildAppointmentSlotKey, buildSlotCountMapKey } from '@/utils/eventFormSlots'
import { PAX_TECUM_2026 } from '@/features/events/data/paxTecumContent'
import './PaxTecumLandingPage.css'

const Arrow = ({ down = false }: { down?: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={down ? 'M12 5v14M6 13l6 6 6-6' : 'M5 12h14M13 6l6 6-6 6'} />
  </svg>
)

const BrandMark = ({ light = false }: { light?: boolean }) => (
  <a className={`pt-brand ${light ? 'pt-brand-light' : ''}`} href="#top" aria-label="Ministry of Altar Servers Pax Tecum 2026 home">
    <img className="pt-brand-logo" src={PAX_TECUM_2026.brand.logoSrc} alt="Ministry of Altar Servers Logo" />
    <span className="pt-brand-copy">
      <strong>{PAX_TECUM_2026.brand.ministryName}</strong>
      <small>{PAX_TECUM_2026.brand.parishName}</small>
    </span>
  </a>
)

const ParishPhoto: React.FC<{
  src: string
  alt: string
  className?: string
  placeholderLabel: string
  placeholderHint?: string
  loading?: 'lazy' | 'eager'
  onErrorStateChange?: (failed: boolean) => void
}> = ({ src, alt, className = '', placeholderLabel, placeholderHint, loading = 'lazy', onErrorStateChange }) => {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className={`${className} pt-placeholder-frame`} role="img" aria-label={alt}>
        <span className="pt-placeholder-badge">Temporary Photo Placeholder</span>
        <strong>{placeholderLabel}</strong>
        {placeholderHint && <small>{placeholderHint}</small>}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => {
        setFailed(true)
        onErrorStateChange?.(true)
      }}
    />
  )
}

export const PaxTecumLandingPage: React.FC = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [failedGalleryIds, setFailedGalleryIds] = useState<Record<string, boolean>>({})
  const [showAllMemories, setShowAllMemories] = useState(false)
  const [closingBgFailed, setClosingBgFailed] = useState(false)

  const [landingSettings, setLandingSettings] = useState<PaxTecumLandingSettings | null>(null)
  const [linkedForm, setLinkedForm] = useState<EventForm | null>(null)
  const [questions, setQuestions] = useState<EventFormQuestion[]>([])
  const [slotCountsMap, setSlotCountsMap] = useState<Record<string, number>>({})
  const [activeDate, setActiveDate] = useState<string>('')
  const [loadingLive, setLoadingLive] = useState(true)
  const [refreshingSlots, setRefreshingSlots] = useState(false)
  const [refreshCooldown, setRefreshCooldown] = useState(0)

  const allMemories = PAX_TECUM_2026.memories.items
  const visibleMemories = showAllMemories ? allMemories : allMemories.slice(0, 5)

  useEffect(() => {
    document.title = 'Pax Tecum 2026 — Ministry of Altar Servers'
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(entry => entry.isIntersecting && entry.target.classList.add('is-visible')),
      { threshold: 0.12 }
    )
    document.querySelectorAll('.pax-tecum-page .pt-reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [showAllMemories])

  useEffect(() => {
    if (lightbox === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null)
      if (event.key === 'ArrowRight') setLightbox((lightbox + 1) % allMemories.length)
      if (event.key === 'ArrowLeft') setLightbox((lightbox - 1 + allMemories.length) % allMemories.length)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [lightbox, allMemories.length])

  useEffect(() => {
    if (refreshCooldown <= 0) return
    const timer = window.setTimeout(() => {
      setRefreshCooldown(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [refreshCooldown])

  useEffect(() => {
    let active = true
    async function loadLiveSchedule() {
      setLoadingLive(true)
      try {
        const cfg = await queryClient.fetchQuery({
          queryKey: ['pax-tecum-landing-settings'],
          queryFn: () => settingsService.getPaxTecumLandingSettings(),
          staleTime: 1000 * 60 * 5
        })
        if (!active) return
        setLandingSettings(cfg)

        if (!cfg.enabled || !cfg.linkedFormId) {
          setLoadingLive(false)
          return
        }

        const formIdentifier = cfg.linkedFormSlug || cfg.linkedFormId
        const formData = await queryClient.fetchQuery({
          queryKey: ['public-event-form', formIdentifier],
          queryFn: () => eventFormService.getFormById(formIdentifier),
          staleTime: 1000 * 60
        })
        if (!active) return
        setLinkedForm(formData)

        if (!formData?.id) {
          setLoadingLive(false)
          return
        }

        if (formData.id !== formIdentifier) {
          queryClient.setQueryData(['public-event-form', formData.id], formData)
        }

        const [qs, counts] = await Promise.all([
          queryClient.fetchQuery({
            queryKey: ['event-form-questions', formData.id],
            queryFn: () => eventFormQuestionService.getQuestionsByFormId(formData.id!),
            staleTime: 1000 * 60
          }),
          eventFormResponseService.getSlotCountsByFormId(formData.id)
        ])

        if (!active) return
        setQuestions(qs)
        setSlotCountsMap(counts)

        const firstApptQ = qs.find(
          q => q.type === 'appointment_slots' && q.appointmentConfig && q.appointmentConfig.length > 0
        )
        if (firstApptQ?.appointmentConfig?.[0]?.date) {
          setActiveDate(firstApptQ.appointmentConfig[0].date)
        }
      } catch (err) {
        console.error('Failed to load Pax Tecum live schedule:', err)
      } finally {
        if (active) setLoadingLive(false)
      }
    }

    loadLiveSchedule()
    return () => {
      active = false
    }
  }, [queryClient])

  const handleRefreshSlots = useCallback(async () => {
    if (!linkedForm?.id || refreshingSlots || refreshCooldown > 0) return
    setRefreshingSlots(true)
    try {
      const freshCounts = await eventFormResponseService.getSlotCountsByFormId(linkedForm.id)
      setSlotCountsMap(freshCounts)
      setRefreshCooldown(5)
    } catch (err) {
      console.error('Failed to refresh Pax Tecum slots:', err)
    } finally {
      setRefreshingSlots(false)
    }
  }, [linkedForm?.id, refreshingSlots, refreshCooldown])

  const appointmentQuestion = useMemo(
    () =>
      questions.find(
        q => q.type === 'appointment_slots' && q.appointmentConfig && q.appointmentConfig.length > 0
      ) || null,
    [questions]
  )

  const formPathSlug = linkedForm?.slug || linkedForm?.id || ''
  const isRegistrationOpen = Boolean(
    landingSettings?.enabled &&
      linkedForm &&
      linkedForm.status === 'published' &&
      linkedForm.isPublic &&
      formPathSlug
  )

  const registerHref = formPathSlug ? `/public/forms/${formPathSlug}?from=pax-tecum` : '#registration'

  const activeDateConfig = useMemo(() => {
    if (!appointmentQuestion?.appointmentConfig?.length) return null
    return (
      appointmentQuestion.appointmentConfig.find(d => d.date === activeDate) ||
      appointmentQuestion.appointmentConfig[0]
    )
  }, [appointmentQuestion, activeDate])

  const slotStats = useMemo(() => {
    if (!appointmentQuestion?.appointmentConfig?.length) {
      return { total: 0, registered: 0, remaining: 0, percent: 0 }
    }
    const targetDates = activeDateConfig ? [activeDateConfig] : appointmentQuestion.appointmentConfig
    let total = 0
    let registered = 0
    targetDates.forEach(dateCfg => {
      dateCfg.slots.forEach(slot => {
        const maxCap = slot.maxCapacity || 0
        if (maxCap <= 0) return
        const key = buildAppointmentSlotKey(dateCfg.date, slot.id)
        const booked = slotCountsMap[buildSlotCountMapKey(appointmentQuestion.id, 'appointment', key)] ?? 0
        total += maxCap
        registered += Math.min(booked, maxCap)
      })
    })
    const remaining = Math.max(0, total - registered)
    const percent = total > 0 ? Math.min(100, Math.round((registered / total) * 100)) : 0
    return { total, registered, remaining, percent }
  }, [appointmentQuestion, activeDateConfig, slotCountsMap])

  const availabilityMeta = useMemo(() => {
    if (loadingLive) {
      return { label: 'Checking status...', tone: 'open' as const }
    }
    if (!isRegistrationOpen) {
      return { label: 'Opening soon', tone: 'closed' as const }
    }
    if (slotStats.total > 0 && slotStats.remaining === 0) {
      return { label: 'Selected date full', tone: 'full' as const }
    }
    if (slotStats.total > 0 && slotStats.percent >= 85) {
      return { label: 'Limited slots', tone: 'warning' as const }
    }
    return { label: 'Registration open', tone: 'open' as const }
  }, [loadingLive, isRegistrationOpen, slotStats])

  const formatDatePill = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00')
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const handleSelectSlot = (dateStr: string, slotId: string) => {
    if (!formPathSlug || !isRegistrationOpen) return
    navigate(
      `/public/forms/${formPathSlug}?date=${encodeURIComponent(dateStr)}&slot=${encodeURIComponent(slotId)}&from=pax-tecum`
    )
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <main id="top" className="pax-tecum-page">
      {/* SECTION 7: HEADER */}
      <header className={`pt-nav ${scrolled || menuOpen ? 'pt-nav-solid' : ''}`}>
        <div className="pt-nav-inner">
          <BrandMark />
          <nav className={`pt-nav-links ${menuOpen ? 'pt-nav-links-open' : ''}`} aria-label="Main navigation">
            <a href="#top" onClick={closeMenu}>Home</a>
            <a href="#about" onClick={closeMenu}>About Pax Tecum</a>
            <a href="#memories" onClick={closeMenu}>Memories</a>
            <a href="#mission" onClick={closeMenu}>Our Mission</a>
            <a href="#registration" onClick={closeMenu}>Registration</a>
            {isRegistrationOpen ? (
              <Link className="pt-button pt-button-accent pt-nav-cta" to={registerHref} onClick={closeMenu}>
                Register Now <Arrow />
              </Link>
            ) : (
              <a className="pt-button pt-button-accent pt-nav-cta" href="#registration" onClick={closeMenu}>
                Register Now <Arrow />
              </a>
            )}
          </nav>
          <button
            type="button"
            className={`pt-menu-button ${menuOpen ? 'pt-menu-button-open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
          >
            <span /><span />
          </button>
        </div>
      </header>

      {/* SECTION 1: HERO */}
      <section className="pt-hero" aria-labelledby="hero-title">
        <ParishPhoto
          className="pt-hero-image"
          src={PAX_TECUM_2026.hero.image.src}
          alt={PAX_TECUM_2026.hero.image.alt}
          placeholderLabel={PAX_TECUM_2026.hero.image.placeholderLabel}
          placeholderHint={PAX_TECUM_2026.hero.image.placeholderHint}
          loading="eager"
        />
        <div className="pt-hero-overlay" />
        <div className="pt-container pt-hero-content">
          <div className="pt-hero-copy">
            <p className="pt-eyebrow"><span /> {PAX_TECUM_2026.hero.eyebrow}</p>
            <h1 id="hero-title">
              {PAX_TECUM_2026.hero.headingLine1}<br />
              <em>{PAX_TECUM_2026.hero.headingHighlight}</em>
            </h1>
            <p className="pt-hero-lead">{PAX_TECUM_2026.hero.description}</p>
            <div className="pt-hero-actions">
              {isRegistrationOpen ? (
                <Link className="pt-button pt-button-accent" to={registerHref}>
                  {PAX_TECUM_2026.hero.primaryCta} <Arrow />
                </Link>
              ) : (
                <a className="pt-button pt-button-accent" href="#registration">
                  {PAX_TECUM_2026.hero.primaryCta} <Arrow />
                </a>
              )}
              <a className="pt-text-link" href="#about">
                {PAX_TECUM_2026.hero.secondaryCta} <span>&#8600;</span>
              </a>
            </div>
          </div>
          <div className={`pt-registration-note ${!isRegistrationOpen ? 'is-closed' : ''}`}>
            <i />
            <span>{isRegistrationOpen ? 'Registration open' : 'Pax Tecum 2026'}</span>
            <b>Dec 25, 26, 28 &amp; 29, 2026 · Free</b>
          </div>
        </div>
      </section>

      {/* SECTION 2: ABOUT PAX TECUM */}
      <section className="pt-section pt-about" id="about">
        <div className="pt-container pt-about-grid">
          <div className="pt-about-visual pt-reveal">
            <ParishPhoto
              className="pt-about-main"
              src={PAX_TECUM_2026.about.mainImage.src}
              alt={PAX_TECUM_2026.about.mainImage.alt}
              placeholderLabel={PAX_TECUM_2026.about.mainImage.placeholderLabel}
              placeholderHint={PAX_TECUM_2026.about.mainImage.placeholderHint}
            />
            <figure className="pt-about-inset">
              <ParishPhoto
                src={PAX_TECUM_2026.about.insetImage.src}
                alt={PAX_TECUM_2026.about.insetImage.alt}
                placeholderLabel={PAX_TECUM_2026.about.insetImage.placeholderLabel}
                placeholderHint={PAX_TECUM_2026.about.insetImage.placeholderHint}
              />
              <figcaption>{PAX_TECUM_2026.about.insetImage.caption}</figcaption>
            </figure>
            <span className="pt-image-index">01 — Our tradition</span>
          </div>
          <div className="pt-about-copy pt-reveal">
            <p className="pt-eyebrow"><span /> {PAX_TECUM_2026.about.eyebrow}</p>
            <h2>
              {PAX_TECUM_2026.about.headingLine1}<br />
              <em>{PAX_TECUM_2026.about.headingHighlight}</em>
            </h2>
            <p className="pt-lead">{PAX_TECUM_2026.about.paragraphs[0]}</p>
            <p>{PAX_TECUM_2026.about.paragraphs[1]}</p>
            <blockquote>
              <span>&ldquo;</span>
              {PAX_TECUM_2026.about.quote}
            </blockquote>
            <a className="pt-text-link" href="#memories">
              {PAX_TECUM_2026.about.ctaLabel} <Arrow />
            </a>
          </div>
        </div>
      </section>

      {/* SECTION 3: MEMORIES GALLERY */}
      <section className="pt-section pt-memories" id="memories">
        <div className="pt-container">
          <div className="pt-section-heading pt-reveal">
            <div>
              <p className="pt-eyebrow"><span /> {PAX_TECUM_2026.memories.eyebrow}</p>
              <h2>
                {PAX_TECUM_2026.memories.headingLine1}<br />
                <em>{PAX_TECUM_2026.memories.headingHighlight}</em>
              </h2>
            </div>
            <p>{PAX_TECUM_2026.memories.description}</p>
          </div>
          <div className="pt-gallery">
            {visibleMemories.map((item, index) => {
              const isPlaceholder = Boolean(failedGalleryIds[item.id])
              return (
                <button
                  type="button"
                  className={`pt-gallery-item ${item.layoutClass} pt-reveal`}
                  style={{ transitionDelay: `${(index % 3) * 90}ms` }}
                  key={item.id}
                  onClick={() => !isPlaceholder && setLightbox(index)}
                  aria-label={`${item.category} — ${item.description}`}
                >
                  <ParishPhoto
                    src={item.src}
                    alt={item.alt}
                    placeholderLabel={item.category}
                    placeholderHint={item.description}
                    onErrorStateChange={failed => {
                      if (failed) {
                        setFailedGalleryIds(prev => ({ ...prev, [item.id]: true }))
                      }
                    }}
                  />
                  {!isPlaceholder && (
                    <>
                      <span className="pt-gallery-shade" />
                      <span className="pt-gallery-caption">
                        <b>{item.category}</b>
                        <small>{item.year ? `Pax Tecum · ${item.year}` : item.description}</small>
                      </span>
                      <span className="pt-gallery-open">&#8599;</span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
          {allMemories.length > 5 && (
            <div className="pt-gallery-more">
              <button
                type="button"
                className="pt-button pt-button-accent"
                onClick={() => setShowAllMemories(prev => !prev)}
              >
                {showAllMemories ? 'Show Fewer Memories' : 'View More Memories'} <Arrow />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 4: THE PURPOSE OF PAX TECUM */}
      <section className="pt-section pt-impact" id="mission">
        <div className="pt-container">
          <div className="pt-impact-intro pt-reveal">
            <p className="pt-eyebrow"><span /> {PAX_TECUM_2026.mission.eyebrow}</p>
            <h2>
              {PAX_TECUM_2026.mission.headingLine1}<br />
              <em>{PAX_TECUM_2026.mission.headingHighlight}</em>
            </h2>
            <p>{PAX_TECUM_2026.mission.description}</p>
          </div>
          <div className="pt-impact-layout">
            <figure className="pt-impact-photo pt-reveal">
              <ParishPhoto
                src={PAX_TECUM_2026.mission.featuredImage.src}
                alt={PAX_TECUM_2026.mission.featuredImage.alt}
                placeholderLabel={PAX_TECUM_2026.mission.featuredImage.placeholderLabel}
                placeholderHint={PAX_TECUM_2026.mission.featuredImage.placeholderHint}
              />
              <figcaption>
                <span>{PAX_TECUM_2026.mission.featuredImage.caption}</span>
                <small>{PAX_TECUM_2026.mission.featuredImage.subcaption}</small>
              </figcaption>
            </figure>
            <div className="pt-impact-list">
              {PAX_TECUM_2026.mission.items.map(item => (
                <article className="pt-impact-item pt-reveal" key={item.number}>
                  <span>{item.number}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                  <i>&#8599;</i>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: HOUSEHOLD REGISTRATION */}
      <section className="pt-section pt-slots" id="registration">
        <div className="pt-container pt-slots-grid">
          <div className="pt-slots-copy pt-reveal">
            <p className="pt-eyebrow"><span /> {PAX_TECUM_2026.registration.eyebrow}</p>
            <h2>
              {PAX_TECUM_2026.registration.headingLine1}<br />
              <em>{PAX_TECUM_2026.registration.headingHighlight}</em>
            </h2>
            <p className="pt-lead">{PAX_TECUM_2026.registration.description}</p>

            {/* Official Event Information */}
            <div className="pt-event-details" id="visitation-details">
              {PAX_TECUM_2026.registration.details.map(item => (
                <div className="pt-event-detail-item" key={item.label}>
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>

            {/* Voluntary Donation Notice */}
            <div className="pt-voluntary-notice" role="note">
              {PAX_TECUM_2026.registration.voluntaryNotice}
            </div>

            {isRegistrationOpen && appointmentQuestion?.appointmentConfig && appointmentQuestion.appointmentConfig.length > 0 && (
              <div className="pt-date-switcher" aria-label="Select preferred visitation date">
                {appointmentQuestion.appointmentConfig.map(dateCfg => (
                  <button
                    type="button"
                    key={dateCfg.id || dateCfg.date}
                    className={activeDateConfig?.date === dateCfg.date ? 'active' : ''}
                    onClick={() => setActiveDate(dateCfg.date)}
                  >
                    {formatDatePill(dateCfg.date)}{dateCfg.label ? ` · ${dateCfg.label}` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`pt-availability-card ${availabilityMeta.tone} pt-reveal`}>
            <div className="pt-availability-top">
              <div>
                <small>Household Registration</small>
                <span className="pt-status">
                  <i />
                  {availabilityMeta.label}
                </span>
              </div>
              {isRegistrationOpen && (
                <button
                  type="button"
                  className="pt-refresh-btn"
                  onClick={handleRefreshSlots}
                  disabled={refreshingSlots || refreshCooldown > 0}
                >
                  {refreshingSlots ? 'Refreshing...' : refreshCooldown > 0 ? `Wait ${refreshCooldown}s` : 'Refresh'}
                </button>
              )}
            </div>

            {loadingLive ? (
              <div className="py-12 text-center text-sm text-slate-500 font-medium">
                Checking registration schedule...
              </div>
            ) : !isRegistrationOpen ? (
              <div className="py-6 space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed">
                  {!landingSettings?.enabled || !landingSettings?.linkedFormId
                    ? 'Online household registration for Pax Tecum 2026 will open here once the registration form is linked and published by the Ministry of Altar Servers.'
                    : `The household registration form (${linkedForm?.title || 'Pax Tecum 2026'}) is currently closed.`}
                </p>
                <div className="pt-schedule-note">
                  {PAX_TECUM_2026.registration.scheduleNote}
                </div>
                <a className="pt-button pt-button-dark" href="#visitation-details">
                  {PAX_TECUM_2026.registration.secondaryCta} <Arrow />
                </a>
              </div>
            ) : (
              <>
                {slotStats.total > 0 && (
                  <>
                    <div className="pt-remaining">
                      <strong>{slotStats.remaining}</strong>
                      <span>
                        slots<br />remaining
                      </span>
                    </div>
                    <div className="pt-progress-label">
                      <span>{activeDateConfig ? `${formatDatePill(activeDateConfig.date)} availability` : 'Visitation availability'}</span>
                      <b>{slotStats.percent}% reserved</b>
                    </div>
                    <div className="pt-progress-track">
                      <span style={{ width: `${slotStats.percent}%` }} />
                    </div>
                    <div className="pt-slot-stats">
                      <div>
                        <small>Capacity</small>
                        <strong>{slotStats.total}</strong>
                      </div>
                      <div>
                        <small>Reserved</small>
                        <strong>{slotStats.registered}</strong>
                      </div>
                      <div>
                        <small>Remaining</small>
                        <strong>{slotStats.remaining}</strong>
                      </div>
                    </div>
                  </>
                )}

                {activeDateConfig && activeDateConfig.slots.length > 0 && (
                  <div className="pt-time-list">
                    {activeDateConfig.slots.map(slot => {
                      const maxCap = slot.maxCapacity || 0
                      const hasCap = maxCap > 0
                      const key = buildAppointmentSlotKey(activeDateConfig.date, slot.id)
                      const booked =
                        slotCountsMap[buildSlotCountMapKey(appointmentQuestion!.id, 'appointment', key)] ?? 0
                      const left = hasCap ? Math.max(0, maxCap - booked) : null
                      const isFull = hasCap && left === 0
                      const isLow = hasCap && left !== null && left > 0 && left <= 3

                      return (
                        <button
                          type="button"
                          key={slot.id}
                          disabled={isFull}
                          onClick={() => handleSelectSlot(activeDateConfig.date, slot.id)}
                          className="pt-time-row"
                        >
                          <div className="pt-time-row-main">
                            <strong>{slot.startTime} – {slot.endTime}</strong>
                            <small>{slot.label || (hasCap ? `${booked} / ${maxCap} reserved` : 'Preferred schedule')}</small>
                          </div>
                          <span className={`pt-time-badge ${isFull ? 'full' : isLow ? 'low' : 'open'}`}>
                            {isFull ? 'Full' : hasCap ? `${left} left` : 'Open'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="pt-schedule-note">
                  {PAX_TECUM_2026.registration.scheduleNote}
                </div>

                <Link
                  className={`pt-button pt-button-dark ${availabilityMeta.tone === 'full' ? 'pt-button-disabled' : ''}`}
                  to={registerHref}
                >
                  {availabilityMeta.tone === 'full' ? 'Selected date full' : PAX_TECUM_2026.registration.primaryCta} <Arrow />
                </Link>
                <p className="pt-data-note">
                  Household addresses and contact numbers remain private and are reviewed only by authorized Ministry organizers.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 6: FINAL CALL TO ACTION */}
      <section className="pt-closing">
        {!closingBgFailed && (
          <img
            src={PAX_TECUM_2026.closing.bgImage}
            alt=""
            onError={() => setClosingBgFailed(true)}
          />
        )}
        <div className="pt-closing-overlay" />
        <div className="pt-container pt-closing-content pt-reveal">
          <p className="pt-eyebrow pt-eyebrow-light"><span /> {PAX_TECUM_2026.closing.eyebrow}</p>
          <h2>
            {PAX_TECUM_2026.closing.headingLine1}<br />
            <em>{PAX_TECUM_2026.closing.headingHighlight}</em>
          </h2>
          <p>{PAX_TECUM_2026.closing.description}</p>
          {isRegistrationOpen ? (
            <Link className="pt-button pt-button-accent" to={registerHref}>
              {PAX_TECUM_2026.closing.ctaLabel} <Arrow />
            </Link>
          ) : (
            <a className="pt-button pt-button-accent" href="#registration">
              {PAX_TECUM_2026.closing.ctaLabel} <Arrow />
            </a>
          )}
        </div>
      </section>

      {/* SECTION 7: FOOTER */}
      <footer className="pt-footer">
        <div className="pt-container">
          <div className="pt-footer-main">
            <div className="pt-footer-brand">
              <BrandMark light />
              <p>{PAX_TECUM_2026.footer.description}</p>
            </div>
            <div className="pt-footer-column">
              <h3>Explore</h3>
              <a href="#top">Home</a>
              <a href="#about">About</a>
              <a href="#memories">Memories</a>
              <a href="#mission">Our Mission</a>
              <a href="#registration">Registration</a>
            </div>
            <div className="pt-footer-column">
              <h3>Pax Tecum 2026</h3>
              <span>{PAX_TECUM_2026.brand.ministryName}</span>
              <span>{PAX_TECUM_2026.brand.parishName}</span>
              <span>December 25, 26, 28, and 29, 2026</span>
            </div>
          </div>
          <div className="pt-footer-bottom">
            <span>{PAX_TECUM_2026.footer.copyright}</span>
            <span>Pax Tecum 2026</span>
          </div>
        </div>
      </footer>

      {/* LIGHTBOX */}
      {lightbox !== null && allMemories[lightbox] && !failedGalleryIds[allMemories[lightbox].id] && (
        <div
          className="pt-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Pax Tecum gallery image preview"
          onClick={() => setLightbox(null)}
        >
          <button type="button" className="pt-lightbox-close" onClick={() => setLightbox(null)} aria-label="Close preview">
            &times;
          </button>
          <button
            type="button"
            className="pt-lightbox-prev"
            onClick={e => {
              e.stopPropagation()
              setLightbox((lightbox - 1 + allMemories.length) % allMemories.length)
            }}
            aria-label="Previous image"
          >
            &larr;
          </button>
          <figure onClick={e => e.stopPropagation()}>
            <img src={allMemories[lightbox].src} alt={allMemories[lightbox].alt} />
            <figcaption>
              <span>{allMemories[lightbox].caption || allMemories[lightbox].category}</span>
              <small>{allMemories[lightbox].year ? `Pax Tecum · ${allMemories[lightbox].year}` : allMemories[lightbox].description}</small>
            </figcaption>
          </figure>
          <button
            type="button"
            className="pt-lightbox-next"
            onClick={e => {
              e.stopPropagation()
              setLightbox((lightbox + 1) % allMemories.length)
            }}
            aria-label="Next image"
          >
            &rarr;
          </button>
        </div>
      )}
    </main>
  )
}
