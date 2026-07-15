import Link from "next/link";

type CtaButtonProps = {
  href?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "light" | "navy";
  className?: string;
  showArrow?: boolean;
};

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h10M11 6l4 4-4 4" />
    </svg>
  );
}

export function CtaButton({
  href = "/ai-demo",
  children,
  variant = "primary",
  className = "",
  showArrow = false,
}: CtaButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold transition-all duration-200 ease-out";
  const styles = {
    primary:
      "bg-brand-600 text-white shadow-md shadow-brand-600/20 hover:bg-brand-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-600/25 active:translate-y-0",
    secondary:
      "border border-slate-200 bg-white text-slate-900 shadow-sm hover:border-brand-300 hover:text-brand-700 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
    light:
      "bg-white text-brand-700 shadow-lg shadow-black/10 hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0",
    navy:
      "bg-[#081426] text-white shadow-md shadow-[#081426]/25 hover:bg-[#0B1426] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 active:translate-y-0",
  }[variant];

  return (
    <Link href={href} className={`${base} ${styles} ${className}`}>
      {children}
      {showArrow && <ArrowIcon />}
    </Link>
  );
}
