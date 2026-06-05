export function PromoBar() {
  const messages = [
    "Free shipping on orders over ₹599 · Across India",
    "New arrivals · Anantapur cold-pressed groundnut oil — now in 1L glass",
    "Members get 5% back on every order · Join free",
  ];
  // Two identical copies → the marquee track animates by -50% for a seamless,
  // continuous left-scrolling loop.
  const loop = [...messages, ...messages];
  return (
    <div className="bg-ng-forest-deep text-ng-paper text-[13px] py-2 overflow-hidden">
      <div className="marquee">
        <div className="marquee__track font-display tracking-wide">
          {loop.map((m, i) => (
            <span key={i} className="marquee__item" aria-hidden={i >= messages.length}>
              <span aria-hidden className="text-ng-clay">◆</span>
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
