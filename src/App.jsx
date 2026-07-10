import { useEffect, useMemo, useState } from 'react'
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
import Checklist from './components/Checklist/Checklist'
import FreebieSheet from './components/Checklist/FreebieSheet'

// NOTE: All auth, reward, and API logic below is unchanged from the original
// BayBlaze Win App. Only the returned UI has been replaced with the mobile
// checklist. Do not modify handlers, effects, or state shape without matching
// backend contract changes.

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
  const referralUrl =
    winState?.referralUrl ||
    `${config.storefrontUrl}/?promo=${encodeURIComponent(referralCode)}`

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

    const timeout = window.setTimeout(() => {
      setShowFreebiePicker(true)
      loadFreebies(session.accountToken)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [isQualified, session?.accountToken])

  async function beginWinFlow(activeSession, accountPayload) {
    const started = await startWinCampaign(activeSession.accountToken, nfcContext)
    setSession(activeSession)
    setAccount(accountPayload)
    setWinState(started)
    setNotice('Your code is ready.')
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
    const copied = await copyTextToClipboard(referralCode)

    setNotice(copied ? 'Copied!' : 'Copy the code and send it to a friend.')
    return copied
  }

  async function handleShareCode() {
    const shareText = `Use my BayBlaze code ${referralCode} for 20% off $20+ at ${config.storefrontUrl}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BayBlaze friend code',
          text: shareText,
          url: referralUrl,
        })
        return
      } catch {
        // user cancelled – fall through to clipboard
      }
    }

    const copied = await copyTextToClipboard(shareText)
    setNotice(copied ? 'Share message copied.' : 'Copy the code and send it to a friend.')
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
    setNotice('Freebie unlocked.')
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

  const visibleFreebies = useMemo(() => {
    const normalizedSearch = freebieSearch.trim().toLowerCase()
    if (!normalizedSearch) return freebies
    return freebies.filter((product) =>
      [product.name, product.brand, product.description, ...(product.categories || [])]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [freebieSearch, freebies])

  return (
    <>
      <Checklist
        account={account}
        referralCode={referralCode}
        referralUrl={referralUrl}
        isQualified={isQualified}
        isBooting={isBooting}
        authBusy={authBusy}
        statusBusy={statusBusy}
        authForm={authForm}
        authMode={authMode}
        demoMode={config.demoMode}
        onAuthSubmit={handleAuthSubmit}
        onAuthFormChange={setAuthForm}
        onAuthModeChange={setAuthMode}
        onGoogleSignIn={handleGoogleSignIn}
        onDemoSignIn={handleDemoSignIn}
        onDemoCompleteOrder={handleDemoCompleteOrder}
        onCopyCode={handleCopyCode}
        onShareCode={handleShareCode}
        onRefresh={refreshWinStatus}
        onOpenFreebie={() => setShowFreebiePicker(true)}
        onSignOut={handleSignOut}
      />

      {showFreebiePicker && isQualified ? (
        <FreebieSheet
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
    </>
  )
}

function Toast({ error, notice }) {
  const message = error || notice
  if (!message) return null
  return (
    <div
      role="status"
      className={`fixed left-1/2 bottom-4 z-[60] -translate-x-1/2 border-2 border-black px-4 py-2 text-xs font-extrabold uppercase tracking-widest ${
        error ? 'bg-red-600 text-white' : 'bg-[var(--bb-green)] text-black'
      }`}
    >
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

async function copyTextToClipboard(text) {
  if (!text) return false

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall back to a selected textarea for browsers that block Clipboard API.
    }
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    return copied
  } catch {
    return false
  }
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
        name:
          product.name || product.title || firstVariant?.productTitle || 'BayBlaze product',
        brand:
          product.brand ||
          product.metadata?.brand ||
          firstVariant?.metadata?.brand ||
          'BayBlaze',
        image,
        price: product.price || product.salePrice || formatPrice(firstVariant?.priceCents),
        categories:
          product.categories ||
          [product.category || product.collectionTitle || 'Vapes'].filter(Boolean),
        description:
          product.description || 'BayBlaze freebie eligible for local Tampa delivery.',
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
