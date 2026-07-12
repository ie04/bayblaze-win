# BayBlaze Win Agent Rules

## Project role

`bayblaze-win` is the customer-facing NFC reward landing app hosted at `win.bayblaze.net`.

The app should stay focused on the promotional reward UX:

1. NFC campaign landing page.
2. Customer sign in or account creation through `bayblaze-api`.
3. Personal friend promo-code generation for 20% off $20+.
4. Waiting state until the code is used by a new customer on that customer's
   first completed order.
5. Freebie claim handoff to the BayBlaze storefront.

## Source-of-record boundaries

- Do not make this repo a commerce database.
- Do not duplicate product catalog data in this repo except demo-mode placeholders.
- Do not call Firebase, Firestore, Medusa, Twilio, or Google APIs directly from browser code.
- Customer auth must go through `bayblaze-api` account routes.
- Promo-code state, referral attribution, completed-order qualification, and freebie eligibility must be owned by `bayblaze-api`.
- Freebie qualification requires the referred friend to use the code on their
  first order. Existing customers may receive the discount if the API allows it,
  but that use must not unlock the referrer's freebie.
- Generated friend codes are shared discount-code records in
  `customer_discount_codes/{CODE}` with `category=win_referral`, created through
  the common `bayblaze-api` discount-code service. They appear in
  `bayblaze-admin` alongside admin promos for centralized visibility, but remain
  managed by the win reward flow.
- Product/freebie data should come from API routes backed by the Medusa inventory source of truth.

## UI style

Match `bayblaze-storefront` customer UI conventions:

- Jost typography.
- Sharp rectangular cards and controls.
- 2px black borders.
- BayBlaze green action states.
- Strong contrast.
- Minimal hard shadows.
- No rounded/glassy customer UI unless a third-party widget requires it.

## Environment

Public browser-safe variables only:

```env
VITE_BAYBLAZE_API_URL=https://api.bayblaze.net
VITE_BAYBLAZE_STOREFRONT_URL=https://bayblaze.net
VITE_BAYBLAZE_WIN_URL=https://win.bayblaze.net
VITE_WIN_CAMPAIGN=nfc-free-vape
VITE_WIN_DEMO_MODE=false
```

Never put service tokens in this Vite app.

## Backend routes expected

```text
POST /v1/customer/win/start
GET  /v1/customer/win/status
GET  /v1/customer/win/freebies
POST /v1/customer/win/freebies/claim
```

These routes should require a BayBlaze customer account session bearer token.

## OAuth/deployment checklist

- Add `https://win.bayblaze.net/auth/google/callback` to `bayblaze-api` OAuth redirect allowlist.
- Add the same redirect URI in Google Cloud OAuth client settings.
- Allow CORS from `https://win.bayblaze.net` for customer auth and win routes.
- The Lovable preview origin `https://bayblaze-tap-win.lovable.app` is also
  allowed in production `bayblaze-api` CORS and OAuth redirect config for
  preview testing. Its Google callback URI is
  `https://bayblaze-tap-win.lovable.app/auth/google/callback`.
- Local Google sign-in testing against production API is allowed from
  `localhost` and `127.0.0.1` on Vite ports `5173`, `5174`, and `5175`; the
  matching `/auth/google/callback` URLs must also exist in Google Cloud OAuth
  settings if testing the full Google redirect locally.
- Configure SPA rewrites so `/auth/google/callback` serves `index.html`.
