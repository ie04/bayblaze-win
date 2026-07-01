const simpleCopy = new Map([
  ['NFC Mailer Reward · 21+ Only', 'BayBlaze Reward · 21+'],
  ['Follow the steps to win a free vape.', 'Win a free vape.'],
  [
    'Sign in, give your friend a 20% off $20+ code, and BayBlaze will keep checking until that code is used on a completed order.',
    'Sign in. Share your code. When your friend orders, choose your freebie.',
  ],
  ['Scan the NFC tag', 'Scan'],
  ['You made it to the private BayBlaze win page from your mailer.', 'You found the reward page.'],
  ['Create or sign into your account', 'Sign in'],
  ['Use the same BayBlaze account system as the storefront.', 'Use your BayBlaze account.'],
  ['Give a friend 20% off', 'Share your code'],
  ['BayBlaze generates your personal 20% off $20+ code automatically.', 'Your friend gets 20% off $20+.'],
  ['Wait for their completed order', 'Friend orders'],
  ['We keep checking until your friend uses the code on a completed order.', 'When your friend orders, your freebie unlocks.'],
  ['Pick an eligible freebie and continue to the storefront to finish the claim.', 'Pick your freebie.'],
  ['This button only appears when VITE_WIN_DEMO_MODE is true.', 'Test the unlock flow.'],
  ['BayBlaze verifies eligible customer age and identity according to checkout and delivery requirements.', 'Must be 21+.'],
  ['One reward flow', 'One reward'],
  ['Promo code use must be tied to a completed friend order before the freebie claim is unlocked.', 'One freebie per qualifying friend order.'],
  ['Freebie redemption still follows BayBlaze product availability, delivery coverage, and checkout rules.', 'Available for Tampa delivery while supplies last.'],
  ['Live reward status', 'Reward status'],
  ['Waiting on friend order', 'Waiting on your friend'],
  ['Ready when you sign in', 'Sign in to start'],
  ['Checking account status', 'Loading'],
  ['Your friend\'s completed order satisfied the reward. Choose your freebie to continue.', 'Your freebie is unlocked. Pick one now.'],
  ['Listening for completed order', 'Waiting for order'],
  ['Leave this page open or come back later. BayBlaze will unlock the freebie once the code is used on a completed order.', 'Come back after your friend orders.'],
  ['Sign in or create an account to generate your friend code.', 'Sign in to get your code.'],
  ['Friend discount', 'Friend code'],
  ['Give this code to a friend', 'Send this code'],
  ['Once this code is used on a completed order, your freebie unlocks automatically.', 'When your friend orders, your freebie unlocks.'],
  ['Reward satisfied. Your freebie picker is open.', 'Freebie unlocked.'],
  ['Account connected', 'Signed in'],
  ['BayBlaze is tracking this reward against your signed-in customer account.', 'Your reward is saved to this account.'],
  ['Access', 'Account'],
  ['Campaign', 'Reward'],
  ['nfc-free-vape', 'Free vape'],
  ['Use your customer account so BayBlaze can connect your promo code and freebie claim.', 'Sign in to get your code.'],
  ['Sign in & generate code', 'Sign in'],
  ['Create account & generate code', 'Create account'],
  ['Choose an eligible product. BayBlaze will send the claim to the storefront so checkout can enforce inventory and delivery rules.', 'Pick one and continue to checkout.'],
  ['Loading eligible freebies', 'Loading freebies'],
  ['Final redemption happens on BayBlaze storefront so the normal checkout rules still apply.', 'Continue to checkout to finish.'],
  ['Preparing claim...', 'Loading...'],
  ['Account connected. Your friend code is ready below.', 'Your code is ready below.'],
  ['Promo code copied. Send it to a friend to unlock your freebie.', 'Code copied. Send it to a friend.'],
  ['Copy the code manually and send it to a friend.', 'Copy the code and send it to a friend.'],
  ['Demo order completed. Freebie picker unlocked.', 'Freebie unlocked.'],
])

const ignoredTags = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT'])

export function installSimpleCopy() {
  if (typeof window === 'undefined') return

  const applyCopy = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const nodes = []

    while (walker.nextNode()) {
      nodes.push(walker.currentNode)
    }

    for (const node of nodes) {
      const parent = node.parentElement
      const value = node.nodeValue

      if (!parent || !value || ignoredTags.has(parent.tagName)) continue

      const normalized = value.replace(/\s+/g, ' ').trim()
      const replacement = simpleCopy.get(normalized)

      if (!replacement) continue

      const leading = value.match(/^\s*/)?.[0] ?? ''
      const trailing = value.match(/\s*$/)?.[0] ?? ''
      node.nodeValue = `${leading}${replacement}${trailing}`
    }
  }

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(applyCopy)
  })

  window.requestAnimationFrame(() => {
    applyCopy()
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  })
}
