// Shared primitives for the mobile checklist. Sharp corners, 2px black borders,
// hard black shadows. No gradients, no rounded anything.

export function HardCard({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag
      className={`bb-card border-2 border-black bg-white ${className}`}
      style={{ boxShadow: '4px 4px 0 0 #000' }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function HardButton({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}) {
  const palette =
    variant === 'primary'
      ? 'bg-[var(--bb-green)] text-black'
      : variant === 'dark'
        ? 'bg-black text-white'
        : 'bg-white text-black'

  return (
    <button
      type={type}
      className={`bb-btn border-2 border-black ${palette} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function HardInput({ className = '', ...rest }) {
  return (
    <input
      className={`bb-input h-14 w-full border-2 border-black bg-white px-4 text-base text-black outline-none placeholder:text-[#7a7a7a] focus:bg-[#f6f8f5] ${className}`}
      {...rest}
    />
  )
}

export function CheckDot({ state, spinning = false }) {
  const base = 'grid h-8 w-8 shrink-0 place-items-center border-2 border-black text-sm font-black'
  if (state === 'complete') {
    return (
      <span className={`${base} bg-[var(--bb-green)] text-black`} aria-hidden="true">
        ✓
      </span>
    )
  }
  if (state === 'active') {
    if (spinning) {
      return (
        <span className={`${base} bg-white`} aria-hidden="true">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
        </span>
      )
    }
    return (
      <span className={`${base} bg-black text-white`} aria-hidden="true">
        •
      </span>
    )
  }
  return (
    <span className={`${base} bg-white text-[#b5b5b5]`} aria-hidden="true">
      ○
    </span>
  )
}
