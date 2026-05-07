import { useEffect, useRef, useState } from 'react'

const BENEFITS = [
  { name: 'Universal Credit',       sub: 'Standard allowance 25+',  amount: 424.90, visible: true  },
  { name: 'Child Benefit',          sub: 'First child rate',         amount: 110.93, visible: true  },
  { name: 'Council Tax Reduction',  sub: 'Local authority scheme',   amount: 120.00, visible: false },
  { name: "Carer's Allowance",      sub: '35+ hours per week',       amount: 354.90, visible: false },
  { name: 'Free School Meals',      sub: 'Per child, per year',      amount:  35.83, visible: false },
]

const TOTAL_MONTHLY = BENEFITS.reduce((s, b) => s + b.amount, 0)
const TOTAL_ANNUAL  = TOTAL_MONTHLY * 12

const B = {
  bg:          '#160c35',
  header:      '#0f0722',
  border:      'rgba(255,255,255,0.09)',
  amber:       '#d4960a',
  amberLight:  '#f0c040',
  amberBg:     'rgba(212,150,10,0.12)',
  amberBorder: 'rgba(212,150,10,0.25)',
  textPrimary: '#ffffff',
  textDim:     'rgba(255,255,255,0.30)',
  rowBg:       'rgba(255,255,255,0.04)',
  rowBorder:   'rgba(255,255,255,0.07)',
  lockBg:      'rgba(15,7,34,0.75)',
  lockBorder:  'rgba(255,255,255,0.12)',
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke={B.amber} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke="rgba(255,255,255,0.4)" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function useCountUp(target, duration = 700, trigger = false) {
  const [value, setValue] = useState(0)
  const frame = useRef(null)
  useEffect(() => {
    if (!trigger) return
    const t0 = performance.now()
    function step(now) {
      const p = Math.min((now - t0) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * ease))
      if (p < 1) frame.current = requestAnimationFrame(step)
      else setValue(Math.round(target))
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [target, duration, trigger])
  return value
}

function VisibleRow({ benefit, delay }) {
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t) }, [delay])
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 10px', borderRadius: 8, marginBottom: 6,
      background: B.rowBg, border: `0.5px solid ${B.rowBorder}`,
      opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(6px)',
      transition: 'opacity 0.35s ease, transform 0.35s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          background: B.amberBg, border: `0.5px solid ${B.amberBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CheckIcon />
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 500, color: B.textPrimary, lineHeight: 1.2, margin: 0 }}>{benefit.name}</p>
          <p style={{ fontSize: 10, color: B.textDim, lineHeight: 1.2, margin: 0 }}>{benefit.sub}</p>
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: B.amber, flexShrink: 0, marginLeft: 8 }}>
        £{benefit.amount.toFixed(2)}/mo
      </span>
    </div>
  )
}

function LockedRow({ benefit, delay }) {
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t) }, [delay])
  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8,
      marginBottom: 6, background: 'rgba(255,255,255,0.02)',
      border: `0.5px solid ${B.rowBorder}`, overflow: 'hidden',
      opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(6px)',
      transition: 'opacity 0.35s ease, transform 0.35s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, filter: 'blur(3px)', userSelect: 'none' }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: B.amberBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckIcon />
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 500, color: B.textPrimary, margin: 0 }}>{benefit.name}</p>
          <p style={{ fontSize: 10, color: B.textDim, margin: 0 }}>{benefit.sub}</p>
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: B.amber, filter: 'blur(3px)', userSelect: 'none' }}>
        £{benefit.amount.toFixed(2)}/mo
      </span>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: B.lockBg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.05)', border: `0.5px solid ${B.lockBorder}`, borderRadius: 6, padding: '3px 8px' }}>
          <LockIcon />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>Unlock to view</span>
        </div>
      </div>
    </div>
  )
}

export default function HeroReportCard() {
  const [phase, setPhase]               = useState(0)
  const [showAnnual, setShowAnnual]     = useState(false)
  const [countTarget, setCountTarget]   = useState(0)
  const [countTrigger, setCountTrigger] = useState(false)

  const displayTotal  = useCountUp(countTarget, 600, countTrigger)
  const annualDisplay = useCountUp(Math.round(TOTAL_ANNUAL), 1000, showAnnual)

  const visibleBenefits = BENEFITS.filter(b => b.visible)
  const lockedBenefits  = BENEFITS.filter(b => !b.visible)

  useEffect(() => {
    let accumulated = 0
    const timers = []

    visibleBenefits.forEach((b, i) => {
      timers.push(setTimeout(() => {
        accumulated += b.amount
        setCountTarget(Math.round(accumulated))
        setCountTrigger(x => !x)
      }, i * 600 + 400))
    })

    const lockStart = visibleBenefits.length * 600 + 600
    timers.push(setTimeout(() => setPhase(1), lockStart))
    timers.push(setTimeout(() => {
      setCountTarget(Math.round(TOTAL_MONTHLY))
      setCountTrigger(x => !x)
      setShowAnnual(true)
    }, lockStart + lockedBenefits.length * 200 + 300))
    timers.push(setTimeout(() => {
      setPhase(0)
      setCountTarget(0)
      setShowAnnual(false)
    }, lockStart + lockedBenefits.length * 200 + 3200))

    return () => timers.forEach(clearTimeout)
  }, [phase])

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div style={{ width: '100%', maxWidth: 340, margin: '0 auto' }}>
      <div style={{ background: B.bg, border: `1px solid ${B.border}`, borderRadius: 16, overflow: 'hidden' }}>

        {/* header */}
        <div style={{ background: B.header, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${B.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: B.amberBg, border: `0.5px solid ${B.amberBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: B.amber, fontSize: 9, fontWeight: 700 }}>CS</span>
            </div>
            <span style={{ color: B.textPrimary, fontSize: 12, fontWeight: 600 }}>ClaimSmart UK</span>
          </div>
          <span style={{ color: B.textDim, fontSize: 10 }}>{today}</span>
        </div>

        {/* total hero */}
        <div style={{ padding: '16px 16px 14px', background: B.amberBg, borderBottom: `1px solid ${B.amberBorder}` }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: B.amber, margin: '0 0 4px' }}>
            You may be missing
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: B.amberLight, lineHeight: 1 }}>
              £{displayTotal.toLocaleString()}
            </span>
            <span style={{ fontSize: 13, color: B.amber }}>/month</span>
          </div>
          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: `0.5px solid ${B.amberBorder}`,
            opacity: showAnnual ? 1 : 0,
            transform: showAnnual ? 'translateY(0)' : 'translateY(4px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
          }}>
            <p style={{ fontSize: 11, color: B.amber, margin: 0 }}>
              That's up to{' '}
              <span style={{ fontWeight: 700, color: B.amberLight }}>£{annualDisplay.toLocaleString()}</span>
              {' '}per year
            </p>
          </div>
        </div>

        {/* benefits list */}
        <div style={{ padding: '12px 14px 8px' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.textDim, margin: '0 0 8px' }}>
            Benefits you qualify for
          </p>
          {phase === 0 && visibleBenefits.map((b, i) => (
            <VisibleRow key={b.name} benefit={b} delay={i * 600 + 300} />
          ))}
          {phase === 1 && (
            <>
              {visibleBenefits.map(b => <VisibleRow key={b.name} benefit={b} delay={0} />)}
              {lockedBenefits.map((b, i) => <LockedRow key={b.name} benefit={b} delay={i * 200 + 100} />)}
            </>
          )}
        </div>

        {/* footer */}
        <div style={{ padding: '10px 14px', borderTop: `0.5px solid ${B.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, color: B.textDim }}>Based on DWP 2026/27 rates</span>
          <button style={{ background: B.amber, color: '#0f0722', fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
            Unlock report
          </button>
        </div>

      </div>
      <p style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 10 }}>
        Example report — your results will be personalised
      </p>
    </div>
  )
}
