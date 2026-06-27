import Image from "next/image";
import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-[#F8FAFC]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <Link href="/" className="mb-8 inline-flex justify-center transition-opacity hover:opacity-90">
          <Image
            src="/images/AJN_marketing_logo.png"
            alt="AJN Marketing"
            width={140}
            height={70}
            className="h-12 w-auto"
            priority
          />
        </Link>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">{title}</h1>
            {subtitle && <p className="mt-2 text-sm leading-6 text-text-muted">{subtitle}</p>}
          </div>
          {children}
        </div>

        {footer && <div className="mt-6 text-center text-sm text-text-muted">{footer}</div>}
      </div>
    </div>
  );
}

export function AuthField({
  label,
  id,
  type = "text",
  autoComplete,
  value,
  onChange,
  required = true,
}: {
  label: string;
  id: string;
  type?: string;
  autoComplete?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-navy-900">{label}</span>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-navy-900 placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
    </label>
  );
}

export function AuthMessage({
  tone,
  message,
}: {
  tone: "error" | "success";
  message: string;
}) {
  const styles =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-emerald-200 bg-growth-50 text-growth-600";

  return (
    <p className={`rounded-xl border px-4 py-3 text-sm font-medium ${styles}`} role="alert">
      {message}
    </p>
  );
}
