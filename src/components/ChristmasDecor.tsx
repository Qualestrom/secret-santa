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
          className="snowflake-particle absolute top-0 rounded-full bg-[#4CE6B8]/40"
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
      {/* Left tapered mint-turquoise ribbon wing */}
      <path
        d="M36 16C28 11 19 10 10 13.5C15 15 15 17 10 18.5C19 22 28 21 36 16Z"
        fill="#4CE6B8"
        stroke="#061A44"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Right tapered mint-turquoise ribbon wing */}
      <path
        d="M52 16C60 11 69 10 78 13.5C73 15 73 17 78 18.5C69 22 60 21 52 16Z"
        fill="#4CE6B8"
        stroke="#061A44"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Deep navy filigree accent lines */}
      <path
        d="M17 16H33M55 16H71"
        stroke="#061A44"
        strokeOpacity="0.6"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* Center 4-point geometric star ornament */}
      <path
        d="M44 6.5L46.8 13.2L53.5 16L46.8 18.8L44 25.5L41.2 18.8L34.5 16L41.2 13.2L44 6.5Z"
        fill="#061A44"
        stroke="#4CE6B8"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="44" cy="16" r="2.2" fill="#4CE6B8" />
      <circle cx="30" cy="16" r="1.4" fill="#FFFFFF" fillOpacity="0.9" />
      <circle cx="58" cy="16" r="1.4" fill="#FFFFFF" fillOpacity="0.9" />
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
      {/* Mint-turquoise luminescence glow behind cup */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 h-28 w-36 -translate-x-1/2 rounded-full bg-[#4CE6B8]/25 blur-2xl" />

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
          fill="#030E29"
          stroke="#4CE6B8"
          strokeWidth="2.2"
        />
        <ellipse
          cx="90"
          cy="17"
          rx="61"
          ry="8.5"
          fill="#02081A"
          fillOpacity="0.88"
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
                <div className="h-4 w-full bg-gradient-to-b from-[#6EF5CD] via-[#4CE6B8] to-[#20B486]" />
                <div className="h-1 w-full bg-[#061A44]" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Layer 3 (Front): Tin Cup Front Wall Covering Lower Stick Stems */}
      <svg
        viewBox="0 0 180 112"
        className="pointer-events-none absolute bottom-0 left-1/2 z-30 h-[112px] w-[180px] -translate-x-1/2 drop-shadow-[0_14px_24px_rgba(3,14,41,0.45)]"
        fill="none"
      >
        <path
          d="M22 16A68 12 0 0 0 158 16L144 96C142.5 104 119 110 90 110C61 110 37.5 104 36 96L22 16Z"
          fill="url(#waitingCupFrontGrad)"
          stroke="#4CE6B8"
          strokeWidth="2.1"
        />
        {/* Highlighted Front Mint-Turquoise Lip */}
        <path
          d="M22 16A68 12 0 0 0 158 16"
          stroke="#A7F3D0"
          strokeOpacity="0.78"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        {/* Decorative Mint-Turquoise Band */}
        <path
          d="M28 50C47 57 68 59 90 59C112 59 133 57 152 50L150 64C132 71 111 73 90 73C69 73 48 71 30 64L28 50Z"
          fill="#4CE6B8"
        />
        {/* Center Geometric Star Medallion */}
        <circle cx="90" cy="60" r="13.5" fill="#061A44" stroke="#4CE6B8" strokeWidth="1.6" />
        <path
          d="M90 50L92.7 57.3L100 60L92.7 62.7L90 70L87.3 62.7L80 60L87.3 57.3L90 50Z"
          fill="#4CE6B8"
        />
        <circle cx="90" cy="60" r="1.8" fill="#FFFFFF" />
        <defs>
          <linearGradient
            id="waitingCupFrontGrad"
            x1="22"
            y1="16"
            x2="158"
            y2="108"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#0B2B6B" />
            <stop offset="0.52" stopColor="#061A44" />
            <stop offset="1" stopColor="#030E29" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
