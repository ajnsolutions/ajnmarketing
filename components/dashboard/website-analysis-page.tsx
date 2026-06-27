function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
        </div>
        {action && (
          <button
            type="button"
            className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            {action}
          </button>
        )}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

function PriorityBadge({ priority }: { priority: "High" | "Medium" | "Low" }) {
  const styles = {
    High: "bg-rose-50 text-rose-600 ring-rose-100",
    Medium: "bg-amber-50 text-amber-700 ring-amber-100",
    Low: "bg-slate-100 text-slate-600 ring-slate-200",
  }[priority];

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {priority} Priority
    </span>
  );
}

function SeoStatusBadge({ status }: { status: "good" | "warning" | "poor" }) {
  const styles = {
    good: "bg-growth-50 text-growth-500 ring-emerald-100",
    warning: "bg-amber-50 text-amber-700 ring-amber-100",
    poor: "bg-rose-50 text-rose-600 ring-rose-100",
  }[status];

  const labels = {
    good: "Good",
    warning: "Needs Work",
    poor: "Critical",
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>
      {labels[status]}
    </span>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-navy-900">{value}</p>
    </article>
  );
}

function AnalysisHero() {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#081426] to-[#0B1426] p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-900/[0.04] sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
              Analysis Status
            </p>
            <span className="inline-flex items-center gap-2 rounded-full bg-growth-500/15 px-3 py-1 text-sm font-semibold text-growth-500 ring-1 ring-emerald-400/20">
              Completed
            </span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Overall Website Score
              </p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                89<span className="text-xl font-semibold text-slate-400"> / 100</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                AI Confidence
              </p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">96%</p>
            </div>
          </div>
          <p className="mt-5 text-sm text-slate-400">
            Last scanned: <span className="font-medium text-slate-300">2 hours ago</span>
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="relative flex h-40 w-40 items-center justify-center">
            <svg viewBox="0 0 36 36" className="h-40 w-40 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#22C55E"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="89 100"
              />
            </svg>
            <div className="absolute text-center">
              <p className="text-3xl font-bold text-white">89</p>
              <p className="text-xs font-medium text-slate-400">Score</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function WebsiteAnalysisPage() {
  const seoItems = [
    { label: "Meta Titles", status: "good" as const, detail: "Unique titles on 94% of pages" },
    { label: "Meta Descriptions", status: "warning" as const, detail: "Missing on 3 key service pages" },
    { label: "Page Speed", status: "good" as const, detail: "Mobile score: 88 · Desktop: 94" },
    { label: "Mobile Friendly", status: "good" as const, detail: "Responsive layout detected" },
    { label: "Indexability", status: "good" as const, detail: "No major crawl blocks found" },
    { label: "Structured Data", status: "warning" as const, detail: "LocalBusiness schema incomplete" },
  ];

  const services = [
    { name: "Water Heater Repair", confidence: 97, opportunity: "High" },
    { name: "Emergency Plumbing", confidence: 95, opportunity: "High" },
    { name: "Drain Cleaning", confidence: 92, opportunity: "Medium" },
    { name: "Leak Detection", confidence: 88, opportunity: "High" },
    { name: "Pipe Repair", confidence: 86, opportunity: "Medium" },
    { name: "Commercial Plumbing", confidence: 79, opportunity: "Medium" },
  ];

  const websiteOpportunities = [
    {
      title: "Missing FAQs",
      priority: "High" as const,
      impact: "Improves local search visibility",
      difficulty: "Low effort",
    },
    {
      title: "More Local Landing Pages",
      priority: "High" as const,
      impact: "Captures nearby city searches",
      difficulty: "Medium effort",
    },
    {
      title: "Internal Linking",
      priority: "Medium" as const,
      impact: "Strengthens service page authority",
      difficulty: "Low effort",
    },
    {
      title: "Image Optimization",
      priority: "Medium" as const,
      impact: "Faster load times on mobile",
      difficulty: "Low effort",
    },
    {
      title: "Review Schema",
      priority: "Medium" as const,
      impact: "Rich results in Google",
      difficulty: "Medium effort",
    },
    {
      title: "Service Area Pages",
      priority: "High" as const,
      impact: "Better geo-targeted rankings",
      difficulty: "Medium effort",
    },
  ];

  const contentIdeas = [
    {
      title: "Top 10 Plumbing Tips for Homeowners",
      seoScore: 82,
      competition: "Medium",
    },
    {
      title: "Signs Your Water Heater Needs Replacing",
      seoScore: 88,
      competition: "Low",
    },
    {
      title: "Emergency Plumbing Checklist",
      seoScore: 79,
      competition: "Medium",
    },
    {
      title: "Seasonal Maintenance Guide",
      seoScore: 85,
      competition: "Low",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Website Analysis
          </h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Our AI has analyzed your website and built a marketing profile for your business.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Refresh Analysis
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#081426]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0B1426] hover:shadow-lg"
          >
            View AI Profile
          </button>
        </div>
      </div>

      <AnalysisHero />

      <SectionCard
        title="Business Profile Learned"
        subtitle="Key details extracted from your website"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ProfileField label="Business Name" value="Riverside Plumbing Co." />
          <ProfileField label="Industry" value="Plumbing & HVAC Services" />
          <ProfileField
            label="Primary Services"
            value="Emergency plumbing, drain cleaning, water heater repair, repiping"
          />
          <ProfileField label="Service Areas" value="Danville, San Ramon, Walnut Creek, Alamo" />
          <ProfileField label="Business Hours" value="Mon–Fri 7am–6pm · Sat 8am–2pm · 24/7 Emergency" />
          <ProfileField label="Phone" value="(555) 482-9100" />
          <ProfileField label="Website" value="riversideplumbing.com" />
          <ProfileField label="Primary Call-To-Action" value="Call Now for Same-Day Service" />
        </div>
      </SectionCard>

      <SectionCard title="AI Brand Voice" subtitle="How your website communicates with customers">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ProfileField label="Writing Tone" value="Friendly, trustworthy, and locally focused" />
          <ProfileField label="Reading Level" value="8th grade — clear and accessible" />
          <ProfileField label="Customer Persona" value="Homeowners and property managers in the East Bay" />
          <ProfileField label="Brand Personality" value="Reliable neighbor · Expert problem-solver" />
          <ProfileField label="Words Frequently Used" value="Trusted, local, fast, licensed, family-owned" />
          <ProfileField label="Words Avoided" value="Cheap, discount, lowest price" />
        </div>
        <blockquote className="mt-4 rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Example extracted from website
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            &ldquo;For over 20 years, Riverside Plumbing Co. has been Danville&apos;s trusted choice
            for honest, same-day plumbing service. From emergency repairs to water heater
            installations, our licensed team treats your home like our own.&rdquo;
          </p>
        </blockquote>
      </SectionCard>

      <SectionCard title="SEO Snapshot" subtitle="Technical and on-page SEO health">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {seoItems.map((item) => (
            <article
              key={item.label}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-navy-900">{item.label}</p>
                <SeoStatusBadge status={item.status} />
              </div>
              <p className="mt-2 text-sm text-text-muted">{item.detail}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Service Detection" subtitle="Services identified from your website content">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.name}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-4 ring-1 ring-slate-200/60"
            >
              <h3 className="font-semibold text-navy-900">{service.name}</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 ring-1 ring-brand-100">
                  {service.confidence}% confidence
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                    service.opportunity === "High"
                      ? "bg-growth-50 text-growth-500 ring-emerald-100"
                      : "bg-amber-50 text-amber-700 ring-amber-100"
                  }`}
                >
                  {service.opportunity} opportunity
                </span>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Website Opportunities"
        subtitle="Priority improvements ranked by estimated ROI"
        action="View all"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {websiteOpportunities.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="font-semibold text-navy-900">{item.title}</h3>
                <PriorityBadge priority={item.priority} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-growth-50 px-3 py-1 font-medium text-growth-600 ring-1 ring-emerald-100">
                  {item.impact}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600 ring-1 ring-slate-200">
                  {item.difficulty}
                </span>
              </div>
              <button
                type="button"
                className="mt-4 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
              >
                Generate Fix
              </button>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Content Opportunities" subtitle="Article ideas based on your services and market">
        <div className="grid gap-4 lg:grid-cols-2">
          {contentIdeas.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-5 ring-1 ring-slate-200/60"
            >
              <h3 className="font-semibold text-navy-900">{item.title}</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-600 ring-1 ring-brand-100">
                  SEO Score: {item.seoScore}
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 ring-1 ring-amber-100">
                  Competition: {item.competition}
                </span>
              </div>
              <button
                type="button"
                className="mt-4 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
              >
                Generate Article
              </button>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="AI Summary" subtitle="Executive overview of your website analysis">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-600">
              What the AI learned
            </h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Riverside Plumbing Co. presents as a trusted, locally focused plumbing business serving
              the Danville and East Bay area. Your website clearly communicates emergency availability,
              licensed expertise, and family-owned values — strong foundations for local SEO and
              Google Business Profile content.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-100 bg-growth-50/50 p-4 ring-1 ring-emerald-100">
              <h3 className="font-semibold text-growth-600">Strengths</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>• Clear service offerings and emergency positioning</li>
                <li>• Strong local trust signals and customer-focused language</li>
                <li>• Good mobile performance and indexability</li>
              </ul>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 ring-1 ring-amber-100">
              <h3 className="font-semibold text-amber-700">Weaknesses</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>• Missing FAQs and structured data on key pages</li>
                <li>• Limited geo-targeted landing pages for nearby cities</li>
                <li>• Meta descriptions incomplete on service pages</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-600">
              Highest ROI improvements
            </h3>
            <ol className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
              <li>1. Add FAQ sections to top service pages</li>
              <li>2. Create landing pages for San Ramon and Walnut Creek</li>
              <li>3. Implement LocalBusiness and review schema markup</li>
            </ol>
          </div>

          <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-5 ring-1 ring-brand-100">
            <h3 className="font-semibold text-navy-900">Next recommended actions</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Approve AI-generated FAQ content, publish two local landing pages, and schedule
              Google Business Profile posts aligned with your highest-opportunity services:
              emergency plumbing and water heater repair.
            </p>
            <button
              type="button"
              className="mt-4 rounded-full bg-[#081426] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0B1426]"
            >
              Go to Approval Center
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
