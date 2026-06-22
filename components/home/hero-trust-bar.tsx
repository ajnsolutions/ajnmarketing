const avatars = [
  { initials: "MR", color: "bg-blue-100 text-blue-700" },
  { initials: "ST", color: "bg-emerald-100 text-emerald-700" },
  { initials: "JL", color: "bg-amber-100 text-amber-700" },
  { initials: "DK", color: "bg-violet-100 text-violet-700" },
  { initials: "AP", color: "bg-rose-100 text-rose-700" },
] as const;

export function HeroTrustBar() {
  return (
    <div className="mt-8 space-y-4 border-t border-slate-200/80 pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex -space-x-2.5">
          {avatars.map((avatar) => (
            <div
              key={avatar.initials}
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold shadow-sm ${avatar.color}`}
            >
              {avatar.initials}
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <span className="text-amber-500" aria-hidden="true">
              ★★★★★
            </span>
            4.9 Average Rating
          </p>
          <p className="text-sm font-semibold text-navy-900">
            Trusted by 250+ Local Businesses
          </p>
        </div>
      </div>
      <p className="text-sm leading-6 text-text-muted">
        <span className="font-semibold text-navy-800">Serving:</span>{" "}
        Plumbing • HVAC • Roofing • Electrical • Insurance
      </p>
    </div>
  );
}
