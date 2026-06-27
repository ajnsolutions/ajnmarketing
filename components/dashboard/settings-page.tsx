function SectionCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] ${className}`}
    >
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  defaultValue,
  type = "text",
}: {
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-navy-900">{label}</span>
      <input
        type={type}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-navy-900 placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
    </label>
  );
}

function Toggle({
  label,
  description,
  defaultChecked,
}: {
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
      <div>
        <p className="text-sm font-semibold text-navy-900">{label}</p>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      </div>
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
    </label>
  );
}

function PlatformRow({
  name,
  status,
  connected,
}: {
  name: string;
  status: string;
  connected: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-bold text-brand-600 ring-1 ring-slate-200">
          {name.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-navy-900">{name}</p>
          <p className="text-sm text-text-muted">{status}</p>
        </div>
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
          connected
            ? "bg-growth-50 text-growth-500 ring-emerald-100"
            : "bg-slate-100 text-slate-600 ring-slate-200"
        }`}
      >
        {connected ? "Connected" : "Not connected"}
      </span>
    </div>
  );
}

export function SettingsPage() {
  const teamMembers = [
    { name: "Mike Reynolds", role: "Owner", email: "mike@riversideplumbing.com" },
    { name: "Sarah Chen", role: "Office Manager", email: "sarah@riversideplumbing.com" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Settings</h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Manage your business profile, notifications, brand voice, and connected platforms.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg"
        >
          Save Changes
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Business Profile" subtitle="Information used across your AJN workspace">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" defaultValue="Riverside Plumbing Co." />
            <Field label="Industry" defaultValue="Plumbing & HVAC" />
            <Field label="Website" defaultValue="https://riversideplumbing.com" />
            <Field label="Phone" defaultValue="(555) 482-9100" type="tel" />
            <Field label="City" defaultValue="Danville" />
            <Field label="State" defaultValue="California" />
          </div>
        </SectionCard>

        <SectionCard title="Notification Preferences" subtitle="Choose how AJN keeps you informed">
          <div className="space-y-3">
            <Toggle
              label="Email reports"
              description="Receive weekly and monthly performance summaries by email."
              defaultChecked
            />
            <Toggle
              label="SMS approvals"
              description="Approve content quickly via text message."
              defaultChecked
            />
            <Toggle
              label="Review alerts"
              description="Get notified when new Google reviews are posted."
              defaultChecked
            />
            <Toggle
              label="Weekly performance summary"
              description="A concise snapshot of visibility, content, and reviews."
              defaultChecked
            />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Brand Voice" subtitle="Guide how AJN AI writes for your business">
        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Tone" defaultValue="Friendly, professional, and local" />
          <Field label="Words to use" defaultValue="Trusted, reliable, local, expert, fast" />
          <Field label="Words to avoid" defaultValue="Cheap, discount, lowest price, generic" />
        </div>
        <p className="mt-4 text-sm leading-6 text-text-muted">
          AJN AI uses these settings when drafting posts, review replies, and email content for
          Riverside Plumbing Co.
        </p>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Team" subtitle="People with access to this workspace">
          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div
                key={member.email}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
              >
                <div>
                  <p className="font-semibold text-navy-900">{member.name}</p>
                  <p className="text-sm text-text-muted">{member.email}</p>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 ring-1 ring-brand-100">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-4 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Invite Team Member
          </button>
        </SectionCard>

        <SectionCard title="Connected Platforms" subtitle="Channels AJN publishes and monitors">
          <div className="space-y-3">
            <PlatformRow
              name="Google Business Profile"
              status="Synced daily · Danville location"
              connected
            />
            <PlatformRow name="Facebook" status="Page connected · Riverside Plumbing" connected />
            <PlatformRow name="Instagram" status="Not yet connected" connected={false} />
            <PlatformRow name="LinkedIn" status="Company page connected" connected />
          </div>
        </SectionCard>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full bg-[#081426] px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
