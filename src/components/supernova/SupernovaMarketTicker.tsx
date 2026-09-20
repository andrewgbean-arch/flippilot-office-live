interface SupernovaMarketTickerProps {
  items: string[];
}

// Was a single hardcoded string with a fabricated specific number
// ("Auction Prices Up 3.2%"), scrolled forever regardless of what was in the
// dealer's stock. Then it took real, caller-computed facts but still scrolled
// them across the screen, which cut sentences off at the edge and made a
// dealer wait for the loop to come round to "3 vehicles need MOT attention".
// It now lays the same real facts out as chips that wrap: everything is
// visible at once, nothing moves, and it reads the same on a phone.
export default function SupernovaMarketTicker({ items }: SupernovaMarketTickerProps) {
  return (
    <section
      aria-label="Stock summary"
      className="w-full bg-black/30 border border-yellow-400/20 rounded-xl backdrop-blur-xl p-3 sm:p-4"
    >
      {items.length === 0 ? (
        <p className="text-sm font-semibold text-yellow-300">No outstanding items across your fleet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item}
              className="px-3 py-1.5 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-sm font-medium text-yellow-200"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
