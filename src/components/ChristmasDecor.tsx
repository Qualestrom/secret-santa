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
  const visibleSticks = Math.min(Math.max(stickCount, 0), 10);
  const spread = visibleSticks <= 1 ? 0 : Math.min(44, (visibleSticks - 1) * 7.5);

  return (
    <div
      className="relative mx-auto h-48 w-56 select-none"
      aria-hidden="true"
    >
      {/* Warm golden glow behind cup */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 h-28 w-36 -translate-x-1/2 rounded-full bg-[#D99B26]/20 blur-2xl" />

      {/* Layer 1 (Back): Tin Cup Dark Interior & Back Rim */}
      <svg
        viewBox="0 0 180 112"
        className="pointer-events-none absolute bottom-0 left-1/2 z-10 h-[112px] w-[180px] -translate-x-1/2"
        fill="none"
      >
        <ellipse
          cx="90"
          cy="16"
          rx="68"
          ry="12"
          fill="#3E0909"
          stroke="#D99B26"
          strokeWidth="2.2"
        />
        <ellipse
          cx="90"
          cy="17"
          rx="61"
          ry="8.5"
          fill="#260505"
          fillOpacity="0.65"
        />
      </svg>

      {/* Layer 2 (Middle): Fanned Wooden Sticks Seated Inside the Cup */}
      <div className="pointer-events-none absolute bottom-[34px] left-1/2 z-20">
        {Array.from({ length: visibleSticks }).map((_, idx) => {
          const t = visibleSticks === 1 ? 0.5 : idx / (visibleSticks - 1);
          const angle = visibleSticks === 1 ? -4 : -spread / 2 + t * spread;
          const offsetX =
            visibleSticks === 1 ? 0 : (idx - (visibleSticks - 1) / 2) * 7;

          return (
            <div
              key={idx}
              className="absolute bottom-0 left-0"
              style={{ transform: `translateX(${offsetX}px)` }}
            >
              <div
                className="stick-sway -ml-2 h-[116px] w-4 origin-bottom overflow-hidden rounded-t-full border border-[#8D643B]/45 bg-gradient-to-r from-[#DFB78A] via-[#F2D9BA] to-[#C89B6E] shadow-sm"
                style={
                  {
                    '--stick-rot': `${angle}deg`,
                    '--stick-sway': `${idx % 2 === 0 ? 1.6 : -1.6}deg`,
                    '--sway-dur': `${3.2 + (idx % 4) * 0.45}s`,
                    '--sway-delay': `${-(idx * 0.55)}s`,
                    transform: `rotate(${angle}deg)`,
                  } as React.CSSProperties
                }
              >
                <div className="h-4 w-full bg-gradient-to-b from-[#DC2626] to-[#B91C1C]" />
                <div className="h-1 w-full bg-[#D99B26]" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Layer 3 (Front): Tin Cup Front Wall Covering Lower Stick Stems */}
      <svg
        viewBox="0 0 180 112"
        className="pointer-events-none absolute bottom-0 left-1/2 z-30 h-[112px] w-[180px] -translate-x-1/2 drop-shadow-[0_14px_24px_rgba(15,41,30,0.28)]"
        fill="none"
      >
        <path
          d="M22 16A68 12 0 0 0 158 16L144 96C142.5 104 119 110 90 110C61 110 37.5 104 36 96L22 16Z"
          fill="url(#waitingCupFrontGrad)"
          stroke="#D99B26"
          strokeWidth="2.1"
        />
        {/* Highlighted Front Gold Lip */}
        <path
          d="M22 16A68 12 0 0 0 158 16"
          stroke="#FDE68A"
          strokeOpacity="0.65"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        {/* Decorative Gold Band */}
        <path
          d="M28 50C47 57 68 59 90 59C112 59 133 57 152 50L150 64C132 71 111 73 90 73C69 73 48 71 30 64L28 50Z"
          fill="#D99B26"
        />
        {/* Center Evergreen Emblem */}
        <circle cx="90" cy="60" r="13.5" fill="#0F291E" stroke="#FFFDF9" strokeWidth="1.6" />
        <path d="M90 50.5L95.5 59H92.2L96.8 65.5H83.2L87.8 59H84.5L90 50.5Z" fill="#D99B26" />
        <defs>
          <linearGradient
            id="waitingCupFrontGrad"
            x1="22"
            y1="16"
            x2="158"
            y2="108"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#DC2626" />
            <stop offset="0.52" stopColor="#B91C1C" />
            <stop offset="1" stopColor="#7F1D1D" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
