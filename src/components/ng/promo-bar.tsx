export function PromoBar() {
  const messages = [
    "Free shipping on orders over ₹599 · Across India",
    "New arrivals · Anantapur cold-pressed groundnut oil — now in 1L glass",
    "Members get 5% back on every order · Join free",
  ];
  return (
    <div className="bg-ng-forest-deep text-ng-paper text-[13px] py-2">
      <div className="mx-auto max-w-7xl px-5 flex items-center justify-center gap-4">
        <div className="announcement-rotate">
          <div className="announcement-rotate__track font-display tracking-wide">
            {/* Duplicate the first message at the end so the loop lands back on
                it seamlessly (the keyframes end at the 4th slot = message 1). */}
            {[...messages, messages[0]].map((m, i) => (
              <span key={i} className="block leading-[1.6em]">{m}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
