import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  buildStorefrontFreebieUrl,
  claimFreebie,
  clearSession,
  completeDemoFriendOrder,
  completeGoogleSignIn,
  config,
  createCustomerAccount,
  getCurrentAccount,
  getFreebieProducts,
  getNfcContext,
  getStoredSession,
  getWinStatus,
  loginCustomerAccount,
  saveSession,
  startGoogleSignIn,
  startWinCampaign,
} from './api'

const qualifiedStatuses = new Set([
  'qualified',
  'completed',
  'friend_order_completed',
  'redeemable',
  'ready_to_claim',
  'claimed',
])

const initialAuthForm = {
  email: '',
  firstName: '',
  lastName: '',
  password: '',
}

function App() {
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState(initialAuthForm)
  const [session, setSession] = useState(() => getStoredSession())
  const [account, setAccount] = useState(null)
  const [winState, setWinState] = useState(null)
  const [freebies, setFreebies] = useState([])
  const [selectedFreebieId, setSelectedFreebieId] = useState('')
  const [freebieSearch, setFreebieSearch] = useState('')
  const [isBooting, setIsBooting] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [claimBusy, setClaimBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showFreebiePicker, setShowFreebiePicker] = useState(false)

  const nfcContext = useMemo(() => getNfcContext(), [])
  const isQualified = isWinQualified(winState)
  const referralCode = winState?.referralCode || winState?.promoCode || ''
  const referralUrl = winState?.referralUrl || `${config.storefrontUrl}/?promo=${encodeURIComponent(referralCode)}`

  const steps = useMemo(
    () => [
      {
        eyebrow: 'Step 1',
        title: 'Scan the NFC tag',
        body: 'You made it to the private BayBlaze win page from your mailer.',
        state: 'complete',
      },
      {
        eyebrow: 'Step 2',
        title: 'Create or sign into your account',
        body: 'Use the same BayBlaze account system as the storefront.',
        state: account ? 'complete' : 'active',
      },
      {
        eyebrow: 'Step 3',
        title: 'Give a friend 20% off',
        body: 'BayBlaze generates your personal 20% off $20+ code automatically.',
        state: referralCode ? 'complete' : account ? 'active' : 'locked',
      },
      {
        eyebrow: 'Step 4',
        title: 'Wait for their completed order',
        body: 'We keep checking until your friend uses the code on a completed order.',
        state: isQualified ? 'complete' : referralCode ? 'active' : 'locked',
      },
      {
        eyebrow: 'Final step',
        title: 'Claim your freebie',
        body: 'Pick an eligible freebie and continue to the storefront to finish the claim.',
        state: isQualified ? 'active' : 'locked',
      },
    ],
    [account, isQualified, referralCode],
  )

  const visibleFreebies = useMemo(() => {
    const normalizedSearch = freebieSearch.trim().toLowerCase()

    if (!normalizedSearch) return freebies

    return freebies.filter((product) => {
      return [product.name, product.brand, product.description, ...(product.categories || [])]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [freebieSearch, freebies])

  useEffect(() => {
    let cancelled = false

    async function boot() {
      setError('')
      setIsBooting(true)

      try {
        const params = new URLSearchParams(window.location.search)
        const oauthCode = params.get('code')
        const oauthState = params.get('state')
        let activeSession = getStoredSession()

        if (oauthCode && oauthState) {
          const oauthSession = await completeGoogleSignIn({
            code: oauthCode,
            state: oauthState,
          })
          activeSession = saveSession(oauthSession)
          window.history.replaceState({}, document.title, '/')
        }

        if (!activeSession?.accountToken) return

        const currentAccount = await getCurrentAccount(activeSession.accountToken)
        const accountPayload = currentAccount.account || currentAccount
        const started = await startWinCampaign(activeSession.accountToken, nfcContext)

        if (cancelled) return

        setSession(activeSession)
        setAccount(accountPayload)
        setWinState(started)
      } catch (bootError) {
        clearSession()
        if (!cancelled) {
          setSession(null)
          setAccount(null)
          setWinState(null)
          setError(readError(bootError))
        }
      } finally {
        if (!cancelled) setIsBooting(false)
      }
    }

    boot()

    return () => {
      cancelled = true
    }
  }, [nfcContext])

  useEffect(() => {
    if (!session?.accountToken || !referralCode || isQualified) return undefined

    const interval = window.setInterval(() => {
      refreshWinStatus({ quiet: true })
    }, 12000)

    return () => window.clearInterval(interval)
  }, [isQualified, referralCode, session?.accountToken])

  useEffect(() => {
    if (!session?.accountToken || !isQualified) return

    setShowFreebiePicker(true)
    loadFreebies(session.accountToken)
  }, [isQualified, session?.accountToken])

  async function beginWinFlow(activeSession, accountPayload) {
    const started = await startWinCampaign(activeSession.accountToken, nfcContext)
    setSession(activeSession)
    setAccount(accountPayload)
    setWinState(started)
    setNotice('Account connected. Your friend code is ready below.')
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthBusy(true)
    setError('')
    setNotice('')

    try {
      const response =
        authMode === 'login'
          ? await loginCustomerAccount(authForm)
          : await createCustomerAccount(authForm)
      const activeSession = saveSession(response)
      await beginWinFlow(activeSession, response.account)
    } catch (authError) {
      setError(readError(authError))
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleGoogleSignIn() {
    setAuthBusy(true)
    setError('')

    try {
      await startGoogleSignIn()
    } catch (googleError) {
      setError(readError(googleError))
      setAuthBusy(false)
    }
  }

  async function handleDemoSignIn() {
    const demoSession = saveSession({
      account: {
        badges: ['customer'],
        displayName: 'BayBlaze Demo Customer',
        email: 'demo@bayblaze.net',
        uid: 'demo-customer',
      },
      commerce: { customerToken: 'demo-commerce-token' },
      session: {
        email: 'demo@bayblaze.net',
        token: 'demo-account-token',
        uid: 'demo-customer',
      },
    })

    await beginWinFlow(demoSession, {
      badges: ['customer'],
      displayName: 'BayBlaze Demo Customer',
      email: 'demo@bayblaze.net',
      uid: 'demo-customer',
    })
  }

  async function refreshWinStatus({ quiet = false } = {}) {
    if (!session?.accountToken) return

    setStatusBusy(true)
    if (!quiet) setError('')

    try {
      const status = await getWinStatus(session.accountToken, nfcContext)
      setWinState(status)
    } catch (statusError) {
      if (!quiet) setError(readError(statusError))
    } finally {
      setStatusBusy(false)
    }
  }

  async function loadFreebies(accountToken) {
    try {
      const response = await getFreebieProducts(accountToken)
      const products = normalizeFreebieProducts(response)
      setFreebies(products)
      setSelectedFreebieId((current) => current || products[0]?.id || '')
    } catch (freebieError) {
      setError(readError(freebieError))
    }
  }

  async function handleCopyCode() {
    if (!referralCode) return

    try {
      await navigator.clipboard.writeText(referralCode)
      setNotice('Promo code copied. Send it to a friend to unlock your freebie.')
    } catch {
      setNotice('Copy the code manually and send it to a friend.')
    }
  }

  async function handleShareCode() {
    const shareText = `Use my BayBlaze code ${referralCode} for 20% off $20+ at ${config.storefrontUrl}`

    if (navigator.share) {
      await navigator.share({
        title: 'BayBlaze friend code',
        text: shareText,
        url: referralUrl,
      })
      return
    }

    await navigator.clipboard.writeText(shareText)
    setNotice('Share message copied.')
  }

  function handleSignOut() {
    clearSession()
    setSession(null)
    setAccount(null)
    setWinState(null)
    setFreebies([])
    setSelectedFreebieId('')
    setShowFreebiePicker(false)
    setNotice('Signed out.')
  }

  function handleDemoCompleteOrder() {
    const nextState = completeDemoFriendOrder()
    setWinState(nextState)
    setNotice('Demo order completed. Freebie picker unlocked.')
  }

  async function handleClaimFreebie(event) {
    event.preventDefault()

    const selectedProduct = freebies.find((product) => product.id === selectedFreebieId)

    if (!selectedProduct) {
      setError('Select a freebie before continuing.')
      return
    }

    setClaimBusy(true)
    setError('')

    try {
      const claim = await claimFreebie(session.accountToken, {
        campaign: nfcContext.campaign,
        claimToken: winState?.claimToken,
        productId: selectedProduct.id,
        variantId: selectedProduct.variantId,
      })

      window.location.assign(
        buildStorefrontFreebieUrl({
          claimToken: claim.claimToken || winState?.claimToken,
          productId: selectedProduct.id,
          variantId: selectedProduct.variantId,
        }),
      )
    } catch (claimError) {
      setError(readError(claimError))
    } finally {
      setClaimBusy(false)
    }
  }

  return (
    <main className="win-shell min-h-screen bg-[var(--ast-global-color-4)] font-[var(--font-jost)] text-black">
      <Header account={account} onSignOut={handleSignOut} />

      <section className="border-b-2 border-black bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="text-left">
            <p className="bayblaze-sharp-badge bayblaze-sharp-badge--green inline-flex">
              NFC Mailer Reward · 21+ Only
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl font-black uppercase leading-[0.92] tracking-[-0.04em] text-black sm:text-6xl lg:text-7xl">
              Follow the steps to win a free vape.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-[1.65] text-[#585858] sm:text-lg">
              Sign in, give your friend a 20% off $20+ code, and BayBlaze will keep checking until that code is used on a completed order.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className="bayblaze-sharp-button bayblaze-sharp-button--primary" href="#win-flow">
                Start now
              </a>
              <a className="bayblaze-sharp-button bayblaze-sharp-button--outline" href={config.storefrontUrl}>
                Visit BayBlaze
              </a>
            </div>
          </div>

          <div className="bayblaze-sharp-card bg-[var(--ast-global-color-4)] p-4 sm:p-6">
            <div className="grid gap-3">
              {steps.map((step) => (
                <StepCard key={step.eyebrow} step={step} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="win-flow" className="mx-auto grid max-w-7xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-5">
          <StatusPanel
            isBooting={isBooting}
            isQualified={isQualified}
            referralCode={referralCode}
            statusBusy={statusBusy}
            winState={winState}
            onRefresh={refreshWinStatus}
          />

          {referralCode ? (
            <ReferralPanel
              referralCode={referralCode}
              referralUrl={referralUrl}
              isQualified={isQualified}
              onCopyCode={handleCopyCode}
              onShareCode={handleShareCode}
            />
          ) : null}

          {config.demoMode && account && !isQualified ? (
            <div className="bayblaze-sharp-card bg-white p-5 text-left">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--ast-global-color-1)]">
                Demo mode
              </p>
              <p className="mt-2 text-sm font-medium leading-[1.6] text-[#585858]">
                This button only appears when VITE_WIN_DEMO_MODE is true.
              </p>
              <button className="bayblaze-sharp-button bayblaze-sharp-button--dark mt-4 w-full" type="button" onClick={handleDemoCompleteOrder}>
                Simulate friend order completed
              </button>
            </div>
          ) : null}
        </div>

        <div>
          {account ? (
            <AccountPanel account={account} />
          ) : (
            <AuthPanel
              authBusy={authBusy}
              authForm={authForm}
              authMode={authMode}
              onChangeForm={setAuthForm}
              onGoogleSignIn={handleGoogleSignIn}
              onModeChange={setAuthMode}
              onSubmit={handleAuthSubmit}
              onDemoSignIn={config.demoMode ? handleDemoSignIn : null}
            />
          )}
        </div>
      </section>

      <section className="border-y-2 border-black bg-black text-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 text-left sm:grid-cols-3 sm:px-6">
          <FinePrint title="21+ only" body="BayBlaze verifies eligible customer age and identity according to checkout and delivery requirements." />
          <FinePrint title="One reward flow" body="Promo code use must be tied to a completed friend order before the freebie claim is unlocked." />
          <FinePrint title="Tampa delivery" body="Freebie redemption still follows BayBlaze product availability, delivery coverage, and checkout rules." />
        </div>
      </section>

      {showFreebiePicker ? (
        <FreebiePicker
          claimBusy={claimBusy}
          error={error}
          freebies={freebies}
          freebieSearch={freebieSearch}
          onClose={() => setShowFreebiePicker(false)}
          onSearchChange={setFreebieSearch}
          onSubmit={handleClaimFreebie}
          onSelect={setSelectedFreebieId}
          selectedFreebieId={selectedFreebieId}
          visibleFreebies={visibleFreebies}
        />
      ) : null}

      <Toast error={error} notice={notice} />
    </main>
  )
}

function Header({ account, onSignOut }) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-black bg-[var(--ast-global-color-4)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <a className="bayblaze-brand-wordmark text-2xl font-medium text-black no-underline" href="/">
          BAYBLAZE
        </a>
        <div className="flex items-center gap-3 text-right">
          {account ? (
            <>
              <div className="hidden text-xs font-bold uppercase tracking-widest text-[#585858] sm:block">
                {account.email}
              </div>
              <button className="bayblaze-sharp-button bayblaze-sharp-button--outline !px-3 !py-2 text-xs" type="button" onClick={onSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <a className="text-xs font-extrabold uppercase tracking-widest text-black no-underline" href="#win-flow">
              Sign in
            </a>
          )}
        </div>
      </div>
    </header>
  )
}

function StepCard({ step }) {
  const isComplete = step.state === 'complete'
  const isActive = step.state === 'active'

  return (
    <article className={`step-card step-card--${step.state}`}>
      <div className="step-card__icon" aria-hidden="true">
        {isComplete ? '✓' : isActive ? '•' : '—'}
      </div>
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--ast-global-color-1)]">
          {step.eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-black uppercase leading-none text-black">{step.title}</h2>
        <p className="mt-2 text-sm font-medium leading-[1.55] text-[#585858]">{step.body}</p>
      </div>
    </article>
  )
}

function StatusPanel({ isBooting, isQualified, referralCode, statusBusy, winState, onRefresh }) {
  const statusLabel = isQualified
    ? 'Freebie unlocked'
    : referralCode
      ? 'Waiting on friend order'
      : 'Ready when you sign in'

  return (
    <section className="bayblaze-sharp-card bg-white p-5 text-left sm:p-6" aria-labelledby="win-status-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--ast-global-color-1)]">
            Live reward status
          </p>
          <h2 id="win-status-heading" className="mt-2 text-3xl font-black uppercase leading-none text-black">
            {statusLabel}
          </h2>
        </div>
        <div className={`status-orb ${isQualified ? 'status-orb--complete' : ''}`} aria-hidden="true" />
      </div>

      <div className="mt-5 border-2 border-black bg-[var(--ast-global-color-4)] p-4">
        {isBooting ? (
          <LoadingLine label="Checking account status" />
        ) : isQualified ? (
          <p className="text-sm font-bold leading-[1.6] text-black">
            Your friend&apos;s completed order satisfied the reward. Choose your freebie to continue.
          </p>
        ) : referralCode ? (
          <div className="space-y-3">
            <LoadingLine label="Listening for completed order" />
            <p className="text-sm font-medium leading-[1.6] text-[#585858]">
              Leave this page open or come back later. BayBlaze will unlock the freebie once the code is used on a completed order.
            </p>
          </div>
        ) : (
          <p className="text-sm font-medium leading-[1.6] text-[#585858]">
            Sign in or create an account to generate your friend code.
          </p>
        )}
      </div>

      {winState?.completedOrderId ? (
        <p className="mt-3 text-xs font-bold uppercase tracking-widest text-[var(--ast-global-color-1)]">
          Completed order: {winState.completedOrderId}
        </p>
      ) : null}

      {referralCode && !isQualified ? (
        <button className="bayblaze-sharp-button bayblaze-sharp-button--outline mt-4 w-full" type="button" disabled={statusBusy} onClick={() => onRefresh()}>
          {statusBusy ? 'Checking...' : 'Check again'}
        </button>
      ) : null}
    </section>
  )
}

function ReferralPanel({ referralCode, referralUrl, isQualified, onCopyCode, onShareCode }) {
  return (
    <section className="bayblaze-sharp-card bg-white p-5 text-left sm:p-6" aria-labelledby="referral-heading">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--ast-global-color-1)]">
        Friend discount
      </p>
      <h2 id="referral-heading" className="mt-2 text-3xl font-black uppercase leading-none text-black">
        Give this code to a friend
      </h2>
      <div className="mt-5 border-2 border-black bg-black p-4 text-white">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#b9d7a0]">20% off $20+</p>
        <p className="mt-2 break-all font-mono text-3xl font-black leading-none tracking-widest sm:text-4xl">
          {referralCode}
        </p>
      </div>
      <p className="mt-3 text-sm font-medium leading-[1.6] text-[#585858]">
        Once this code is used on a completed order, your freebie unlocks automatically.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button className="bayblaze-sharp-button bayblaze-sharp-button--primary" type="button" onClick={onCopyCode}>
          Copy code
        </button>
        <button className="bayblaze-sharp-button bayblaze-sharp-button--dark" type="button" onClick={onShareCode}>
          Share message
        </button>
      </div>
      <a className="mt-4 block break-all text-xs font-bold text-[#585858] underline" href={referralUrl} target="_blank" rel="noreferrer">
        {referralUrl}
      </a>
      {isQualified ? (
        <p className="mt-3 border-2 border-black bg-[var(--ast-global-color-4)] px-3 py-2 text-sm font-bold text-[var(--ast-global-color-1)]">
          Reward satisfied. Your freebie picker is open.
        </p>
      ) : null}
    </section>
  )
}

function AccountPanel({ account }) {
  return (
    <section className="bayblaze-sharp-card bg-white p-5 text-left sm:p-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--ast-global-color-1)]">
        Account connected
      </p>
      <h2 className="mt-2 text-4xl font-black uppercase leading-none text-black">
        You&apos;re in.
      </h2>
      <p className="mt-4 text-base font-medium leading-[1.65] text-[#585858]">
        BayBlaze is tracking this reward against your signed-in customer account.
      </p>
      <dl className="mt-6 grid gap-3">
        <InfoRow label="Email" value={account.email || 'Connected'} />
        <InfoRow label="Access" value={(account.badges || ['customer']).join(', ')} />
        <InfoRow label="Campaign" value={config.campaign} />
      </dl>
    </section>
  )
}

function AuthPanel({ authBusy, authForm, authMode, onChangeForm, onGoogleSignIn, onModeChange, onSubmit, onDemoSignIn }) {
  function updateField(field, value) {
    onChangeForm((current) => ({ ...current, [field]: value }))
  }

  return (
    <section className="bayblaze-sharp-card bg-white p-5 text-left sm:p-8" aria-labelledby="auth-heading">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--ast-global-color-1)]">
        BayBlaze account
      </p>
      <h2 id="auth-heading" className="mt-2 text-4xl font-black uppercase leading-none text-black">
        Sign in to start
      </h2>
      <p className="mt-3 text-sm font-medium leading-[1.65] text-[#585858]">
        Use your customer account so BayBlaze can connect your promo code and freebie claim.
      </p>

      <div className="mt-6 grid grid-cols-2 border-2 border-black bg-white">
        <button
          type="button"
          aria-pressed={authMode === 'login'}
          className={`h-12 border-r-2 border-black text-sm font-extrabold uppercase tracking-widest transition-colors ${
            authMode === 'login' ? 'bg-black text-white' : 'bg-white text-black hover:bg-[var(--ast-global-color-4)]'
          }`}
          onClick={() => onModeChange('login')}
        >
          Login
        </button>
        <button
          type="button"
          aria-pressed={authMode === 'register'}
          className={`h-12 text-sm font-extrabold uppercase tracking-widest transition-colors ${
            authMode === 'register' ? 'bg-black text-white' : 'bg-white text-black hover:bg-[var(--ast-global-color-4)]'
          }`}
          onClick={() => onModeChange('register')}
        >
          Register
        </button>
      </div>

      <button className="mt-5 flex h-12 w-full items-center justify-center gap-3 border-2 border-black bg-white px-4 text-sm font-extrabold uppercase tracking-wider text-black transition-colors hover:bg-black hover:text-white" type="button" disabled={authBusy} onClick={onGoogleSignIn}>
        <span className="grid size-5 place-items-center border-2 border-black bg-white text-xs font-black text-black">G</span>
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3 text-xs font-extrabold uppercase tracking-[0.16em] text-[#585858]">
        <span className="h-0.5 flex-1 bg-black" />
        <span>Email</span>
        <span className="h-0.5 flex-1 bg-black" />
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        {authMode === 'register' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthInput label="First name" value={authForm.firstName} autoComplete="given-name" onChange={(value) => updateField('firstName', value)} />
            <AuthInput label="Last name" value={authForm.lastName} autoComplete="family-name" onChange={(value) => updateField('lastName', value)} />
          </div>
        ) : null}
        <AuthInput label="Email" type="email" value={authForm.email} autoComplete="email" onChange={(value) => updateField('email', value)} />
        <AuthInput label="Password" type="password" value={authForm.password} minLength={12} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} onChange={(value) => updateField('password', value)} />
        {authMode === 'register' ? (
          <p className="text-xs font-bold leading-[1.5] text-[#585858]">
            Password must be at least 12 characters and include letters, numbers, and a symbol.
          </p>
        ) : null}
        <button className="bayblaze-sharp-button bayblaze-sharp-button--primary flex h-[52px] w-full items-center justify-center" type="submit" disabled={authBusy}>
          {authBusy ? 'Working...' : authMode === 'login' ? 'Sign in & generate code' : 'Create account & generate code'}
        </button>
      </form>

      {onDemoSignIn ? (
        <button className="bayblaze-sharp-button bayblaze-sharp-button--outline mt-3 w-full" type="button" onClick={onDemoSignIn}>
          Demo sign in
        </button>
      ) : null}
    </section>
  )
}

function AuthInput({ autoComplete, label, minLength, onChange, type = 'text', value }) {
  return (
    <label className="block text-xs font-extrabold uppercase tracking-widest text-black">
      {label}
      <input
        required
        autoComplete={autoComplete}
        className="bayblaze-sharp-input mt-2 h-12 text-base font-medium normal-case tracking-normal"
        minLength={minLength}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function FreebiePicker({ claimBusy, error, freebies, freebieSearch, onClose, onSearchChange, onSelect, onSubmit, selectedFreebieId, visibleFreebies }) {
  return (
    <div className="freebie-overlay" role="dialog" aria-modal="true" aria-labelledby="freebie-heading">
      <div className="freebie-modal bayblaze-sharp-card bg-[var(--ast-global-color-4)]">
        <div className="sticky top-0 z-10 border-b-2 border-black bg-white p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="text-left">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--ast-global-color-1)]">
                Freebie unlocked
              </p>
              <h2 id="freebie-heading" className="mt-1 text-3xl font-black uppercase leading-none text-black sm:text-5xl">
                Select your freebie
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-[1.6] text-[#585858]">
                Choose an eligible product. BayBlaze will send the claim to the storefront so checkout can enforce inventory and delivery rules.
              </p>
            </div>
            <button className="grid size-11 shrink-0 place-items-center border-2 border-black bg-white text-2xl font-black leading-none hover:bg-black hover:text-white" type="button" aria-label="Close freebie picker" onClick={onClose}>
              ×
            </button>
          </div>

          <form className="mt-5 flex max-w-xl border-2 border-black bg-white" role="search" onSubmit={(event) => event.preventDefault()}>
            <label className="sr-only" htmlFor="freebie-search">Search freebies</label>
            <div className="grid w-11 place-items-center border-r-2 border-black bg-[var(--ast-global-color-4)] text-lg font-black">⌕</div>
            <input
              id="freebie-search"
              className="min-w-0 flex-1 bg-white px-3 py-3 text-sm font-medium text-black outline-none placeholder:text-[#7a7a7a]"
              placeholder="Search brand, product, category…"
              type="search"
              value={freebieSearch}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </form>
        </div>

        <form className="p-4 sm:p-6" onSubmit={onSubmit}>
          {freebies.length === 0 ? (
            <div className="border-2 border-black bg-white p-8 text-center">
              <LoadingLine label="Loading eligible freebies" />
            </div>
          ) : visibleFreebies.length === 0 ? (
            <div className="border-2 border-black bg-white p-8 text-center">
              <p className="text-2xl font-black uppercase">No matches</p>
              <p className="mt-1 text-sm font-medium text-[#585858]">Try a different search term.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {visibleFreebies.map((product) => (
                <FreebieProductCard
                  key={product.id}
                  product={product}
                  selected={selectedFreebieId === product.id}
                  onSelect={() => onSelect(product.id)}
                />
              ))}
            </div>
          )}

          {error ? <p className="mt-4 text-sm font-bold text-red-700">{error}</p> : null}

          <div className="sticky bottom-0 mt-6 border-2 border-black bg-white p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <p className="text-sm font-bold leading-[1.5] text-[#585858]">
              Final redemption happens on BayBlaze storefront so the normal checkout rules still apply.
            </p>
            <button className="bayblaze-sharp-button bayblaze-sharp-button--primary mt-3 w-full shrink-0 sm:mt-0 sm:w-auto" type="submit" disabled={claimBusy || !selectedFreebieId}>
              {claimBusy ? 'Preparing claim...' : 'Continue to storefront'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FreebieProductCard({ onSelect, product, selected }) {
  return (
    <label className={`freebie-product-card ${selected ? 'freebie-product-card--selected' : ''}`}>
      <input className="sr-only" checked={selected} name="freebie" type="radio" value={product.id} onChange={onSelect} />
      <div className="relative aspect-square overflow-hidden border-b-2 border-black bg-[var(--ast-global-color-4)]">
        {product.image ? <img alt={product.name} className="h-full w-full object-contain p-3" src={product.image} /> : <div className="grid h-full place-items-center p-4 text-center text-sm font-black uppercase text-[#585858]">BayBlaze</div>}
        {selected ? <span className="bayblaze-sharp-badge bayblaze-sharp-badge--green absolute left-2 top-2">Selected</span> : null}
      </div>
      <div className="p-3 text-left sm:p-4">
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--ast-global-color-1)]">{product.brand}</p>
        <h3 className="line-clamp-2 text-sm font-bold uppercase leading-tight text-black sm:text-base">{product.name}</h3>
        <p className="mt-3 text-base font-bold leading-none text-black">{product.price || 'Freebie'}</p>
      </div>
    </label>
  )
}

function FinePrint({ body, title }) {
  return (
    <div className="border-2 border-white p-4">
      <p className="text-sm font-black uppercase tracking-widest">{title}</p>
      <p className="mt-2 text-sm font-medium leading-[1.6] text-[#d8d8d8]">{body}</p>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="grid grid-cols-[112px_1fr] gap-3 border-2 border-black bg-[var(--ast-global-color-4)] px-3 py-2 text-sm">
      <dt className="font-extrabold uppercase tracking-widest text-[#585858]">{label}</dt>
      <dd className="min-w-0 break-words font-bold text-black">{value}</dd>
    </div>
  )
}

function LoadingLine({ label }) {
  return (
    <div className="flex items-center gap-3 text-left">
      <span className="loading-spinner" aria-hidden="true" />
      <span className="text-sm font-extrabold uppercase tracking-widest text-black">{label}</span>
    </div>
  )
}

function Toast({ error, notice }) {
  const message = error || notice
  if (!message) return null

  return (
    <div className={`toast ${error ? 'toast--error' : ''}`} role="status">
      {message}
    </div>
  )
}

function isWinQualified(winState) {
  if (!winState) return false

  return Boolean(
    qualifiedStatuses.has(winState.status) ||
      winState.completedOrderId ||
      winState.qualifiedAt,
  )
}

function readError(error) {
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

function normalizeFreebieProducts(response) {
  const products = Array.isArray(response?.products) ? response.products : []

  return products
    .map((product) => {
      const firstVariant = Array.isArray(product.variants) ? product.variants[0] : null
      const image = readProductImage(product, firstVariant)
      const id = product.id || product.productId || firstVariant?.productId
      const variantId = product.variantId || firstVariant?.id

      if (!id) return null

      return {
        id,
        variantId,
        name: product.name || product.title || firstVariant?.productTitle || 'BayBlaze product',
        brand: product.brand || product.metadata?.brand || firstVariant?.metadata?.brand || 'BayBlaze',
        image,
        price: product.price || product.salePrice || formatPrice(firstVariant?.priceCents),
        categories: product.categories || [product.category || product.collectionTitle || 'Vapes'].filter(Boolean),
        description: product.description || 'BayBlaze freebie eligible for local Tampa delivery.',
      }
    })
    .filter(Boolean)
}

function readProductImage(product, variant) {
  const candidates = [
    product.image,
    product.thumbnail,
    product.imageUrl,
    product.imageUrls?.[0],
    product.images?.[0]?.src,
    product.images?.[0]?.url,
    typeof product.images?.[0] === 'string' ? product.images[0] : '',
    variant?.imageUrl,
    variant?.imageUrls?.[0],
  ]

  return candidates.find((item) => typeof item === 'string' && item.trim()) || ''
}

function formatPrice(cents) {
  if (!Number.isFinite(cents)) return ''

  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    style: 'currency',
  }).format(cents / 100)
}

export default App
