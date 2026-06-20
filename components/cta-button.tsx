import Link from "next/link";

type CtaButtonProps = {
  href?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

export function CtaButton({
  href = "/demo",
  children,
  variant = "primary",
  className = "",
}: CtaButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-semibold transition-colors";
  const styles =
    variant === "primary"
      ? "bg-brand-600 text-white hover:bg-brand-700"
      : "border border-slate-300 bg-white text-slate-900 hover:border-brand-600 hover:text-brand-700";

  return (
    <Link href={href} className={`${base} ${styles} ${className}`}>
      {children}
    </Link>
  );
}
