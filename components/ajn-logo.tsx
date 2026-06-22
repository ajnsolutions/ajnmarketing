type AJNLogoProps = {
  className?: string;
  showWordmark?: boolean;
  /** Monogram height in pixels. Default is ~15% larger than the prior base size. */
  size?: number;
};

const BRAND_NAVY = "#0B1736";
const BRAND_GREEN = "#22C55E";

function Monogram({ height = 46 }: { height?: number }) {
  const width = Math.round(height * (56 / 38));

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 56 38"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M1 34V8h2.8l4.4 9.2L12.6 8H15.4v26h-2.6v-9.1L9.4 34H7.6L4.2 24.9V34H1Z"
        fill={BRAND_NAVY}
      />
      <path
        d="M16.5 34V13h2v17.5c0 2.4 1.6 3.5 3.6 3.5s3.6-1.1 3.6-3.5V13h2v17.5c0 3.8-2.6 5.5-5.6 5.5s-5.6-1.7-5.6-5.5Z"
        fill={BRAND_NAVY}
      />
      <path d="M27 34V8h2.4v26H27Z" fill={BRAND_NAVY} />
      <path d="M29.4 8 41.2 34H38.6L29.4 12.8V8Z" fill={BRAND_NAVY} />
      <path
        d="M44.2 34V15.5"
        stroke={BRAND_GREEN}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M44.2 12.5 41.2 16.5 47.2 16.5 44.2 12.5Z"
        fill={BRAND_GREEN}
      />
    </svg>
  );
}

export function AJNLogo({
  className = "",
  showWordmark = true,
  size = 46,
}: AJNLogoProps) {
  return (
    <div
      className={`flex items-center gap-3.5 ${className}`}
      aria-label="AJN Marketing"
      role="img"
    >
      <Monogram height={size} />

      {showWordmark && (
        <div className="flex flex-col justify-center leading-none">
          <span
            className="text-[1.4rem] font-bold tracking-[-0.03em]"
            style={{ color: BRAND_NAVY }}
          >
            AJN
          </span>
          <span className="mt-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.32em] text-text-muted">
            Marketing
          </span>
        </div>
      )}
    </div>
  );
}

/** @deprecated Use AJNLogo */
export const AjnLogo = AJNLogo;
