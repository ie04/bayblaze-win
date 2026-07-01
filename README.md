# BayBlaze Win

Gamified NFC landing page for `win.bayblaze.net`.

Customers scan an NFC mailer, sign in or create a BayBlaze account, receive a personal friend promo code for **20% off $20+**, wait until the code is used on a completed order, and then claim an eligible freebie through the storefront handoff.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Environment

Copy `.env.example` to `.env.local` for local development.

```env
VITE_BAYBLAZE_API_URL=https://api.bayblaze.net
VITE_BAYBLAZE_STOREFRONT_URL=https://bayblaze.net
VITE_BAYBLAZE_WIN_URL=https://win.bayblaze.net
VITE_WIN_CAMPAIGN=nfc-free-vape
VITE_WIN_DEMO_MODE=false
```

Use `VITE_WIN_DEMO_MODE=true` only to preview the full UI before the win backend routes are deployed.

## API contract expected from `bayblaze-api`

This app uses the same customer auth boundary as the storefront:

```text
POST /v1/customer/auth/accounts
POST /v1/customer/auth/login
POST /v1/auth/google/start
POST /v1/auth/google/callback
GET  /v1/auth/me
```

It also expects these customer-session routes for the NFC reward flow:

```text
POST /v1/customer/win/start
GET  /v1/customer/win/status
GET  /v1/customer/win/freebies
POST /v1/customer/win/freebies/claim
```

Suggested response shape for `/v1/customer/win/start` and `/v1/customer/win/status`:

```json
{
  "referralCode": "BLAZE20-ABCD",
  "referralUrl": "https://bayblaze.net/?promo=BLAZE20-ABCD",
  "status": "waiting_for_friend_order",
  "completedOrderId": null,
  "claimToken": null
}
```

When the friend order is complete, return one of these statuses: `qualified`, `completed`, `friend_order_completed`, `redeemable`, or `ready_to_claim`, plus a `claimToken` if the storefront needs one.

Suggested response shape for `/v1/customer/win/freebies`:

```json
{
  "products": [
    {
      "id": "prod_...",
      "variantId": "variant_...",
      "name": "Geek Bar Pulse X 30K",
      "brand": "Geek Bar",
      "image": "https://...",
      "price": "$24.99",
      "categories": ["Vapes"],
      "description": "Eligible BayBlaze freebie."
    }
  ]
}
```

## Deployment notes

- Add `https://win.bayblaze.net/auth/google/callback` to the `bayblaze-api` OAuth redirect allowlist.
- Add the same URL to the Google Cloud OAuth web client authorized redirect URIs.
- Allow CORS from `https://win.bayblaze.net` on the public customer auth and win routes.
- Configure the host to rewrite all paths to `index.html`, including `/auth/google/callback`.
- The final storefront popup still needs a companion storefront patch that reads `freebie_picker=1` and `win_claim` from `/shop`.

## Style rules

Follow the BayBlaze storefront sharp UI system: Jost typography, rectangular controls, 2px black borders, BayBlaze green action states, strong contrast, and no rounded/glassy customer UI.
