import { DemoForm } from "./demo-form";

export default function DemoPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-center gap-8 rounded-2xl bg-white px-8 py-12 dark:bg-black sm:items-start">
        <div className="flex flex-col gap-2 text-center sm:text-left">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Request a free demo
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Tell us about your business and we&apos;ll be in touch.
          </p>
        </div>
        <DemoForm />
      </main>
    </div>
  );
}
