export function SnowfallLayer() {
  const flakes = [
    { left: '6%', size: 4, duration: '11s', delay: '0s' },
    { left: '14%', size: 6, duration: '15s', delay: '-4s' },
    { left: '22%', size: 3, duration: '12s', delay: '-7s' },
    { left: '31%', size: 5, duration: '14s', delay: '-2s' },
    { left: '41%', size: 4, duration: '10s', delay: '-5s' },
    { left: '52%', size: 6, duration: '16s', delay: '-9s' },
    { left: '61%', size: 3, duration: '13s', delay: '-3s' },
    { left: '70%', size: 5, duration: '12s', delay: '-6s' },
    { left: '79%', size: 4, duration: '15s', delay: '-1s' },
    { left: '88%', size: 6, duration: '11s', delay: '-8s' },
    { left: '95%', size: 3, duration: '14s', delay: '-4s' },
  ];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-10 overflow-hidden"
    >
      {flakes.map((flake, idx) => (
        <span
          key={idx}
          className="snowflake-particle absolute top-0 rounded-full bg-[#FFFDF9]/50"
          style={{
            left: flake.left,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            animationDuration: flake.duration,
            animationDelay: flake.delay,
          }}
        />
      ))}
    </div>
  );
}

export function HollySprig({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 88 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Left leaf */}
      <path
        d="M40 16C34 9 23 7 15 11C19 14 19 18 14 21C22 23 33 21 40 16Z"
        fill="#1E5B3E"
        stroke="#0F291E"
        strokeWidth="1.2"
      />
      {/* Right leaf */}
      <path
        d="M48 16C54 9 65 7 73 11C69 14 69 18 74 21C66 23 55 21 48 16Z"
        fill="#1E5B3E"
        stroke="#0F291E"
        strokeWidth="1.2"
      />
      {/* Gold accent veins */}
      <path
        d="M19 16L37 16M51 16L69 16"
        stroke="#D99B26"
        strokeOpacity="0.65"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Three holly berries */}
      <circle cx="44" cy="13.5" r="3.4" fill="#B91C1C" />
      <circle cx="40.5" cy="18.5" r="3.2" fill="#991B1B" />
      <circle cx="47.5" cy="18.5" r="3.2" fill="#DC2626" />
      <circle cx="43.2" cy="12.5" r="0.9" fill="#FFFDF9" fillOpacity="0.7" />
    </svg>
  );
}

export function WaitingStickCup({ stickCount }: { stickCount: number }) {
  const visibleSticks = Math.min(Math.max(stickCount, 1), 10);
  const angles = [-22, -16, -11, -6, -2, 3, 8, 13, 18, 24];

  return (
    <div className="relative mx-auto flex h-48 w-52 items-end justify-center select-none" aria-hidden="true">
      {/* Warm golden glow behind cup */}
      <div className="absolute bottom-4 h-28 w-28 rounded-full bg-[#D99B26]/20 blur-2xl" />

      {/* Fanning wooden sticks inside waiting tin */}
      <div className="relative bottom-[74px] flex items-end justify-center">
        {Array.from({ length: visibleSticks }).map((_, idx) => {
          const angle = angles[idx % angles.length];
          const offsetX = (idx - (visibleSticks - 1) / 2) * 8;
          return (
            <div
              key={idx}
              className="absolute bottom-0 h-28 w-3.5 origin-bottom rounded-t-full border border-[#8D643B]/40 bg-gradient-to-b from-[#EED2AF] via-[#DFB78A] to-[#C89B6E] shadow-sm transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
              style={{
                transform: `translateX(${offsetX}px) rotate(${angle}deg)`,
              }}
            >
              {/* Crimson & Gold Tip */}
              <div className="h-4 w-full rounded-t-full bg-[#B91C1C]" />
              <div className="h-1 w-full bg-[#D99B26]" />
            </div>
          );
        })}
      </div>

      {/* Festive Holiday Cup / Tin */}
      <svg
        viewBox="0 0 180 112"
        className="relative z-10 h-28 w-44 drop-shadow-[0_14px_24px_rgba(0,0,0,0.35)]"
        fill="none"
      >
        {/* Cup Rim */}
        <ellipse cx="90" cy="14" rx="68" ry="12" fill="#7F1D1D" stroke="#D99B26" strokeWidth="2.2" />
        {/* Cup Body */}
        <path
          d="M24 16L36 96C37.5 104 61 110 90 110C119 110 142.5 104 144 96L156 16C146 23 120 26 90 26C60 26 34 23 24 16Z"
          fill="url(#cupGrad)"
          stroke="#D99B26"
          strokeWidth="2"
        />
        {/* Decorative Gold Band */}
        <path
          d="M29 48C46 55 67 57 90 57C113 57 134 55 151 48L149 62C133 69 112 71 90 71C68 71 47 69 31 62L29 48Z"
          fill="#D99B26"
        />
        {/* Center Pine Emblem */}
        <circle cx="90" cy="56" r="13" fill="#0F291E" stroke="#FFFDF9" strokeWidth="1.5" />
        <path
          d="M90 47L95 55H92L96.5 61H83.5L88 55H85L90 47Z"
          fill="#D99B26"
        />
        <defs>
          <linearGradient id="cupGrad" x1="24" y1="16" x2="156" y2="108" gradientUnits="userSpaceOnUse">
            <stop stopColor="#DC2626" />
            <stop offset="0.52" stopColor="#B91C1C" />
            <stop offset="1" stopColor="#7F1D1D" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
