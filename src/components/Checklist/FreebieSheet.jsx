import { HardButton, HardInput } from './ui'

export default function FreebieSheet({
  claimBusy,
  error,
  freebies,
  freebieSearch,
  onClose,
  onSearchChange,
  onSelect,
  onSubmit,
  selectedFreebieId,
  visibleFreebies,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="freebie-heading"
    >
      <header className="sticky top-0 z-10 border-b-2 border-black bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--bb-green-dark)]">
              Freebie unlocked
            </p>
            <h2
              id="freebie-heading"
              className="text-2xl font-black uppercase leading-none text-black"
            >
              Pick one
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center border-2 border-black bg-white text-2xl font-black leading-none"
            style={{ boxShadow: '3px 3px 0 0 #000' }}
          >
            ×
          </button>
        </div>
        <div className="mt-3">
          <HardInput
            type="search"
            placeholder="Search freebies…"
            value={freebieSearch}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </header>

      <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {freebies.length === 0 ? (
            <div className="border-2 border-black bg-[#f6f8f5] p-8 text-center text-sm font-bold uppercase tracking-widest">
              Loading freebies…
            </div>
          ) : visibleFreebies.length === 0 ? (
            <div className="border-2 border-black bg-[#f6f8f5] p-8 text-center">
              <p className="text-xl font-black uppercase">No matches</p>
              <p className="mt-1 text-sm text-[#585858]">Try a different search.</p>
            </div>
          ) : (
            <div
              className="freebie-carousel -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 pt-1"
              aria-label="Eligible freebies"
            >
              {visibleFreebies.map((product) => {
                const selected = selectedFreebieId === product.id
                return (
                  <label
                    key={product.id}
                    className={`relative flex w-[44vw] min-w-[154px] max-w-[178px] snap-start cursor-pointer flex-col border-2 border-black ${selected ? 'bg-[var(--bb-green)]' : 'bg-white'}`}
                    style={{
                      boxShadow: selected ? '4px 4px 0 0 #000' : '2px 2px 0 0 #000',
                    }}
                  >
                    <input
                      type="radio"
                      name="freebie"
                      className="sr-only"
                      checked={selected}
                      value={product.id}
                      onChange={() => onSelect(product.id)}
                    />
                    <div className="aspect-[1/0.86] border-b-2 border-black bg-white">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-contain p-2.5"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-xs font-black uppercase text-[#585858]">
                          BayBlaze
                        </div>
                      )}
                    </div>
                    <div className="flex min-h-[112px] flex-1 flex-col p-3">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--bb-green-dark)]">
                        {product.brand}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm font-bold uppercase leading-tight text-black">
                        {product.name}
                      </p>
                      <p className="mt-auto pt-2 text-sm font-black leading-none text-black">
                        {product.price || 'Freebie'}
                      </p>
                    </div>
                    {selected ? (
                      <span
                        className="absolute right-2 top-2 grid h-7 w-7 place-items-center border-2 border-black bg-black text-sm font-black text-white"
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                    ) : null}
                  </label>
                )
              })}
            </div>
          )}

          {error ? (
            <p className="mt-3 border-2 border-black bg-white px-3 py-2 text-sm font-bold text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="border-t-2 border-black bg-white p-4">
          <HardButton
            type="submit"
            variant="primary"
            className="w-full"
            disabled={claimBusy || !selectedFreebieId}
          >
            {claimBusy ? 'Loading…' : 'Claim & continue'}
          </HardButton>
        </div>
      </form>
    </div>
  )
}
