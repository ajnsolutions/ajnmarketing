import { DemoForm } from "./demo-form";

export const metadata = {
  title: "Free Demo",
  description:
    "Request a free demo and see how AJN Marketing improves your Google visibility, reviews, and local content.",
};

export default function DemoPage() {
  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
              Free demo
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
              See what we&apos;d do for your business
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Tell us about your company and we&apos;ll show you how AJN
              Marketing can improve your Google visibility, reviews, and local
              content — without you doing the marketing.
            </p>
            <ul className="mt-8 space-y-3 text-sm leading-7 text-slate-700">
              <li>• Built for contractors, trades, and local service businesses</li>
              <li>• No contracts to start — just a free look at your opportunity</li>
              <li>• We respond quickly with a demo tailored to your town</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Request your free demo
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Fill out the form and we&apos;ll be in touch.
            </p>
            <div className="mt-6">
              <DemoForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
