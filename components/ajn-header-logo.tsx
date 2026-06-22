const NAVY = "#0B1426";
const BLUE = "#2563EB";
const MUTED = "#64748B";

function GrowthArrow({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6 10V2M6 2L3 5M6 2L9 5"
        stroke={BLUE}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type HeaderLogoProps = {
  className?: string;
};

export function HeaderLogo({ className = "" }: HeaderLogoProps) {
  return (
    <div
      className={`w-[110px] md:w-[130px] ${className}`}
      role="img"
      aria-label="AJN Marketing"
    >
      <div className="relative inline-flex max-w-full items-start leading-none">
        <span
          className="text-[1.65rem] font-extrabold tracking-[-0.04em] md:text-[1.85rem]"
          style={{ color: NAVY, fontFamily: "var(--font-logo), sans-serif" }}
        >
          AJN
        </span>
        <GrowthArrow className="ml-0.5 mt-0.5 h-3 w-3 shrink-0 md:h-3.5 md:w-3.5" />
      </div>

      <p
        className="mt-1 text-[0.48rem] font-semibold uppercase md:text-[0.52rem]"
        style={{
          color: MUTED,
          fontFamily: "var(--font-logo), sans-serif",
          letterSpacing: "0.38em",
        }}
      >
        MARKETING
      </p>
    </div>
  );
}
