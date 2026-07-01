const accountStorageKey = 'bayblaze_account_token'
const commerceStorageKey = 'bayblaze_customer_token'
const demoWinStorageKey = 'bayblaze_win_demo_state'

export const config = {
  apiBaseUrl: (import.meta.env.VITE_BAYBLAZE_API_URL || 'https://api.bayblaze.net').replace(/\/$/, ''),
  storefrontUrl: (import.meta.env.VITE_BAYBLAZE_STOREFRONT_URL || 'https://bayblaze.net').replace(/\/$/, ''),
  winUrl:
    import.meta.env.VITE_BAYBLAZE_WIN_URL?.replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://win.bayblaze.net'),
  campaign: import.meta.env.VITE_WIN_CAMPAIGN || 'nfc-free-vape',
  demoMode: import.meta.env.VITE_WIN_DEMO_MODE === 'true',
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getStoredSession() {
  if (typeof window === 'undefined') return null

  const accountToken = window.localStorage.getItem(accountStorageKey)
  const customerToken = window.localStorage.getItem(commerceStorageKey)

  return accountToken ? { accountToken, customerToken } : null
}

export function saveSession(sessionResponse) {
  const accountToken = sessionResponse?.session?.token
  const customerToken = sessionResponse?.commerce?.customerToken

  if (!accountToken) {
    throw new ApiError('BayBlaze did not return an account session token.', 500)
  }

  window.localStorage.setItem(accountStorageKey, accountToken)

  if (customerToken) {
    window.localStorage.setItem(commerceStorageKey, customerToken)
  }

  return { accountToken, customerToken }
}

export function clearSession() {
  window.localStorage.removeItem(accountStorageKey)
  window.localStorage.removeItem(commerceStorageKey)
}

export function getNfcContext() {
  const params = new URLSearchParams(window.location.search)

  return {
    campaign: params.get('campaign') || config.campaign,
    nfcTagId: params.get('tag') || params.get('nfc') || '',
    source: params.get('source') || 'nfc-mailer',
  }
}

export function getGoogleCallbackUrl() {
  return `${config.winUrl}/auth/google/callback`
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const payload = await readPayload(response)

  if (!response.ok) {
    throw new ApiError(readErrorMessage(payload, response.status), response.status)
  }

  return payload
}

export function loginCustomerAccount({ email, password }) {
  return apiRequest('/v1/customer/auth/login', {
    method: 'POST',
    body: { email: email.trim().toLowerCase(), password },
  })
}

export function createCustomerAccount({ email, firstName, lastName, password }) {
  return apiRequest('/v1/customer/auth/accounts', {
    method: 'POST',
    body: {
      email: email.trim().toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password,
      metadata: {
        source: 'bayblaze-win',
        campaign: config.campaign,
      },
    },
  })
}

export function getCurrentAccount(accountToken) {
  return apiRequest('/v1/auth/me', { token: accountToken })
}

export async function startGoogleSignIn() {
  const oauth = await apiRequest('/v1/auth/google/start', {
    method: 'POST',
    body: {
      callbackUrl: getGoogleCallbackUrl(),
      redirectTo: '/',
      commerce: 'storefront',
    },
  })

  if (!oauth.authorizationUrl) {
    throw new ApiError('BayBlaze did not return a Google sign-in URL.', 500)
  }

  window.location.assign(oauth.authorizationUrl)
}

export function completeGoogleSignIn({ code, state }) {
  return apiRequest('/v1/auth/google/callback', {
    method: 'POST',
    body: {
      callbackUrl: getGoogleCallbackUrl(),
      code,
      state,
    },
  })
}

export async function startWinCampaign(accountToken, context = getNfcContext()) {
  return winRequest('/v1/customer/win/start', {
    method: 'POST',
    token: accountToken,
    body: context,
  })
}

export async function getWinStatus(accountToken, context = getNfcContext()) {
  const params = new URLSearchParams({
    campaign: context.campaign,
    source: context.source,
  })

  if (context.nfcTagId) {
    params.set('tag', context.nfcTagId)
  }

  return winRequest(`/v1/customer/win/status?${params.toString()}`, {
    token: accountToken,
  })
}

export async function getFreebieProducts(accountToken) {
  return winRequest('/v1/customer/win/freebies', {
    token: accountToken,
  })
}

export async function claimFreebie(accountToken, input) {
  return winRequest('/v1/customer/win/freebies/claim', {
    method: 'POST',
    token: accountToken,
    body: input,
  })
}

export function buildStorefrontFreebieUrl({ claimToken, productId, variantId }) {
  const params = new URLSearchParams({
    freebie_picker: '1',
  })

  if (claimToken) params.set('win_claim', claimToken)
  if (productId) params.set('product_id', productId)
  if (variantId) params.set('variant_id', variantId)

  return `${config.storefrontUrl}/shop?${params.toString()}`
}

async function winRequest(path, options) {
  try {
    return await apiRequest(path, options)
  } catch (error) {
    if (!config.demoMode) throw error

    return demoWinResponse(path, options)
  }
}

async function readPayload(response) {
  const text = await response.text()

  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function readErrorMessage(payload, status) {
  if (payload && typeof payload.message === 'string') return payload.message
  if (payload && typeof payload.error === 'string') return payload.error

  return `BayBlaze API request failed with HTTP ${status}.`
}

function readDemoWinState() {
  const fallback = {
    referralCode: 'BLAZE20-813',
    referralUrl: `${config.storefrontUrl}/?promo=BLAZE20-813`,
    status: 'waiting_for_friend_order',
    completedOrderId: '',
    claimToken: 'demo-claim-token',
  }

  try {
    return JSON.parse(window.localStorage.getItem(demoWinStorageKey)) || fallback
  } catch {
    return fallback
  }
}

function writeDemoWinState(nextState) {
  window.localStorage.setItem(demoWinStorageKey, JSON.stringify(nextState))
  return nextState
}

function demoWinResponse(path, options) {
  if (path.startsWith('/v1/customer/win/freebies/claim')) {
    return {
      claimToken: 'demo-claim-token',
      productId: options.body?.productId,
      variantId: options.body?.variantId,
      status: 'claimed',
    }
  }

  if (path.startsWith('/v1/customer/win/freebies')) {
    return { products: demoProducts }
  }

  if (path.startsWith('/v1/customer/win/status')) {
    return readDemoWinState()
  }

  if (path.startsWith('/v1/customer/win/start')) {
    return writeDemoWinState(readDemoWinState())
  }

  throw new ApiError('Demo mode does not support this route.', 404)
}

export function completeDemoFriendOrder() {
  return writeDemoWinState({
    ...readDemoWinState(),
    status: 'qualified',
    completedOrderId: 'demo-order-813',
    claimToken: 'demo-claim-token',
  })
}

const demoProducts = [
  {
    id: 'demo-geekbar-pulse-x',
    variantId: 'demo-geekbar-pulse-x-blue-razz',
    name: 'Geek Bar Pulse X 30K',
    brand: 'Geek Bar',
    image: 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=900&q=80',
    price: '$24.99',
    categories: ['Vapes'],
    description: 'Smooth draw, long battery life, and bold flavor for local Tampa delivery.',
  },
  {
    id: 'demo-raz-ltx',
    variantId: 'demo-raz-ltx-watermelon',
    name: 'RAZ LTX 25K',
    brand: 'RAZ',
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80',
    price: '$22.99',
    categories: ['Vapes'],
    description: 'A compact disposable with vivid flavor and a clean, modern device feel.',
  },
  {
    id: 'demo-lost-mary',
    variantId: 'demo-lost-mary-strawberry',
    name: 'Lost Mary MT35K Turbo',
    brand: 'Lost Mary',
    image: 'https://images.unsplash.com/photo-1584305574647-0cc949a2bb9f?auto=format&fit=crop&w=900&q=80',
    price: '$26.99',
    categories: ['Vapes'],
    description: 'A high-capacity pick with steady output and a smooth everyday profile.',
  },
]
