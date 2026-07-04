import { useMemo, useState } from 'react'
import { CheckDot, HardButton, HardCard, HardInput } from './ui'

// The 5-step mobile checklist. Only one step is expanded at a time.
// Auto-expands the earliest active step; the user can tap any completed
// or active row to expand it manually.

export default function Checklist({
  // state
  account,
  referralCode,
  referralUrl,
  isQualified,
  isBooting,
  authBusy,
  statusBusy,
  authForm,
  authMode,
  demoMode,
  // handlers
  onAuthSubmit,
  onAuthFormChange,
  onAuthModeChange,
  onGoogleSignIn,
  onDemoSignIn,
  onDemoCompleteOrder,
  onCopyCode,
  onShareCode,
  onRefresh,
  onOpenFreebie,
  onSignOut,
}) {
  const stepState = useMemo(() => {
    return {
      signin: account ? 'complete' : 'active',
      code: referralCode ? 'complete' : account ? 'active' : 'locked',
      send: referralCode ? 'active' : 'locked',
      wait: isQualified ? 'complete' : referralCode ? 'active' : 'locked',
      freebie: isQualified ? 'active' : 'locked',
    }
  }, [account, referralCode, isQualified])

  const autoActive = useMemo(() => {
    if (isQualified) return 'freebie'
    if (!account) return 'signin'
    if (!referralCode) return 'code'
    return 'send'
  }, [account, referralCode, isQualified])

  const [manualOpen, setManualOpen] = useState(null)
  const openId = manualOpen && stepState[manualOpen] !== 'locked' ? manualOpen : autoActive

  function toggle(id) {
    if (stepState[id] === 'locked') return
    setManualOpen((current) => (current === id ? null : id))
  }

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col bg-[#f6f8f5]">
      <Header account={account} onSignOut={onSignOut} />

      <div className="flex flex-1 flex-col gap-3 px-4 pb-8 pt-4">
        <div className="mb-1 text-center">
          <h1 className="text-3xl font-black uppercase tracking-tight text-black">
            Win A Free Vape!!
          </h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-[#585858]">
            Create your own 20% off code, share it with a friend, and get a freebie when they successfully complete their order.
          </p>
        </div>
        <StepRow
          id="signin"
          index={1}
          title="Sign in"
          state={stepState.signin}
          open={openId === 'signin'}
          onToggle={toggle}
          summary={account?.email}
        >
          <SignInBody
            authBusy={authBusy}
            authForm={authForm}
            authMode={authMode}
            onSubmit={onAuthSubmit}
            onFormChange={onAuthFormChange}
            onModeChange={onAuthModeChange}
            onGoogleSignIn={onGoogleSignIn}
            onDemoSignIn={demoMode ? onDemoSignIn : null}
          />
        </StepRow>

        <StepRow
          id="code"
          index={2}
          title="Get your code"
          state={stepState.code}
          open={openId === 'code'}
          onToggle={toggle}
          summary={referralCode || (isBooting && account ? 'Loading…' : null)}
        >
          {referralCode ? (
            <CodeBody referralCode={referralCode} onCopyCode={onCopyCode} />
          ) : (
            <p className="text-sm font-medium text-[#585858]">
              {isBooting ? 'Fetching your code…' : 'Your code will appear here after sign in.'}
            </p>
          )}
        </StepRow>

        <StepRow
          id="send"
          index={3}
          title="Send to a friend"
          state={stepState.send}
          open={openId === 'send'}
          onToggle={toggle}
        >
          {referralCode ? (
            <SendBody
              referralCode={referralCode}
              referralUrl={referralUrl}
              onShareCode={onShareCode}
              onCopyCode={onCopyCode}
            />
          ) : null}
        </StepRow>

        <StepRow
          id="wait"
          index={4}
          title="Friend places an order"
          state={stepState.wait}
          open={openId === 'wait'}
          onToggle={toggle}
          summary={isQualified ? 'Order confirmed' : referralCode ? 'Waiting…' : null}
        >
          <WaitBody
            isQualified={isQualified}
            statusBusy={statusBusy}
            onRefresh={onRefresh}
            demoMode={demoMode}
            onDemoCompleteOrder={onDemoCompleteOrder}
          />
        </StepRow>

        <StepRow
          id="freebie"
          index={5}
          title="Pick your freebie"
          state={stepState.freebie}
          open={openId === 'freebie'}
          onToggle={toggle}
        >
          {isQualified ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-[#585858]">
                Choose a product and continue to checkout.
              </p>
              <HardButton variant="primary" className="w-full" onClick={onOpenFreebie}>
                Open freebie picker
              </HardButton>
            </div>
          ) : (
            <p className="text-sm font-medium text-[#585858]">
              Unlocks after your friend&apos;s order is confirmed.
            </p>
          )}
        </StepRow>
      </div>
    </div>
  )
}

function Header({ account, onSignOut }) {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-black bg-white">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="text-lg font-black uppercase tracking-widest text-black">
          BAYBLAZE
        </div>
        {account ? (
          <button
            type="button"
            onClick={onSignOut}
            className="border-2 border-black bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest"
          >
            Sign out
          </button>
        ) : (
          <span className="border-2 border-black bg-[var(--bb-green)] px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest text-black">
            Reward
          </span>
        )}
      </div>
    </header>
  )
}

function StepRow({ id, index, title, state, open, summary, onToggle, children }) {
  const locked = state === 'locked'
  return (
    <HardCard className={locked ? 'opacity-60' : ''}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        disabled={locked}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-4 text-left disabled:cursor-not-allowed"
      >
        <CheckDot state={state} spinning={id === 'wait' && state === 'active'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#585858]">
              Step {index}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="truncate text-lg font-black uppercase leading-tight text-black">
              {title}
            </span>
          </div>
          {!open && summary ? (
            <p className="mt-1 truncate font-mono text-xs font-bold text-[#585858]">
              {summary}
            </p>
          ) : null}
        </div>
        {!locked ? (
          <span
            aria-hidden="true"
            className={`text-xl font-black leading-none transition-transform ${open ? 'rotate-180' : ''}`}
          >
            ⌄
          </span>
        ) : null}
      </button>
      {open && !locked ? (
        <div className="border-t-2 border-black px-4 py-4">{children}</div>
      ) : null}
    </HardCard>
  )
}

function SignInBody({
  authBusy,
  authForm,
  authMode,
  onSubmit,
  onFormChange,
  onModeChange,
  onGoogleSignIn,
  onDemoSignIn,
}) {
  function update(field, value) {
    onFormChange((current) => ({ ...current, [field]: value }))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 border-2 border-black">
        {['login', 'register'].map((mode, i) => (
          <button
            key={mode}
            type="button"
            aria-pressed={authMode === mode}
            onClick={() => onModeChange(mode)}
            className={`h-11 text-xs font-extrabold uppercase tracking-widest ${
              i === 0 ? 'border-r-2 border-black' : ''
            } ${authMode === mode ? 'bg-black text-white' : 'bg-white text-black'}`}
          >
            {mode === 'login' ? 'Login' : 'Register'}
          </button>
        ))}
      </div>

      <HardButton
        variant="outline"
        className="w-full"
        onClick={onGoogleSignIn}
        disabled={authBusy}
      >
        Continue with Google
      </HardButton>

      <div className="flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-widest text-[#585858]">
        <span className="h-0.5 flex-1 bg-black" />
        <span>or email</span>
        <span className="h-0.5 flex-1 bg-black" />
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {authMode === 'register' ? (
          <>
            <HardInput
              required
              autoComplete="given-name"
              placeholder="First name"
              value={authForm.firstName}
              onChange={(e) => update('firstName', e.target.value)}
            />
            <HardInput
              required
              autoComplete="family-name"
              placeholder="Last name"
              value={authForm.lastName}
              onChange={(e) => update('lastName', e.target.value)}
            />
          </>
        ) : null}
        <HardInput
          required
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={authForm.email}
          onChange={(e) => update('email', e.target.value)}
        />
        <HardInput
          required
          type="password"
          minLength={authMode === 'register' ? 12 : undefined}
          autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
          placeholder="Password"
          value={authForm.password}
          onChange={(e) => update('password', e.target.value)}
        />
        {authMode === 'register' ? (
          <p className="text-[11px] font-bold text-[#585858]">
            12+ characters with letters, numbers, and a symbol.
          </p>
        ) : null}
        <HardButton type="submit" variant="primary" className="w-full" disabled={authBusy}>
          {authBusy ? 'Working…' : authMode === 'login' ? 'Sign in' : 'Create account'}
        </HardButton>
      </form>

      {onDemoSignIn ? (
        <HardButton variant="outline" className="w-full" onClick={onDemoSignIn}>
          Demo sign in
        </HardButton>
      ) : null}
    </div>
  )
}

function CodeBody({ referralCode, onCopyCode }) {
  return (
    <div className="space-y-3">
      <div className="border-2 border-black bg-black p-4 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[var(--bb-green)]">
          20% off $20+
        </p>
        <p className="mt-2 break-all font-mono text-3xl font-black tracking-widest text-white">
          {referralCode}
        </p>
      </div>
      <HardButton variant="primary" className="w-full" onClick={onCopyCode}>
        Copy code
      </HardButton>
    </div>
  )
}

function SendBody({ referralCode, referralUrl, onShareCode, onCopyCode }) {
  const text = `Use my BayBlaze code ${referralCode} for 20% off $20+`
  const encoded = encodeURIComponent(`${text} ${referralUrl}`)
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[#585858]">
        Send it any way you want. Native share works on most phones.
      </p>
      <HardButton variant="primary" className="w-full" onClick={onShareCode}>
        Share
      </HardButton>
      <div className="grid grid-cols-3 gap-2">
        <a
          href={`sms:?&body=${encoded}`}
          className="border-2 border-black bg-white py-3 text-center text-[11px] font-extrabold uppercase tracking-widest"
        >
          SMS
        </a>
        <a
          href={`https://wa.me/?text=${encoded}`}
          target="_blank"
          rel="noreferrer"
          className="border-2 border-black bg-white py-3 text-center text-[11px] font-extrabold uppercase tracking-widest"
        >
          WhatsApp
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent('20% off BayBlaze')}&body=${encoded}`}
          className="border-2 border-black bg-white py-3 text-center text-[11px] font-extrabold uppercase tracking-widest"
        >
          Email
        </a>
      </div>
      <button
        type="button"
        onClick={onCopyCode}
        className="w-full text-center text-xs font-bold uppercase tracking-widest text-[#585858] underline"
      >
        Or copy code
      </button>
    </div>
  )
}

function WaitBody({ isQualified, statusBusy, onRefresh, demoMode, onDemoCompleteOrder }) {
  if (isQualified) {
    return (
      <p className="text-sm font-bold text-black">
        Order confirmed. Your freebie is unlocked below.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[#585858]">
        Leave this open or come back later. We&apos;ll unlock the freebie the moment their order
        is confirmed.
      </p>
      <HardButton variant="outline" className="w-full" onClick={() => onRefresh()} disabled={statusBusy}>
        {statusBusy ? 'Checking…' : 'Check again'}
      </HardButton>
      {demoMode ? (
        <HardButton variant="dark" className="w-full" onClick={onDemoCompleteOrder}>
          Demo: simulate order
        </HardButton>
      ) : null}
    </div>
  )
}
