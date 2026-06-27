"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthField, AuthMessage, AuthShell } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell
      title="Log in"
      subtitle="Access your AJN Marketing dashboard."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthMessage tone="error" message={error} />}

        <AuthField
          label="Email"
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
        />

        <AuthField
          label="Password"
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Logging in..." : "Log In"}
        </button>
      </form>
    </AuthShell>
  );
}
