"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthField, AuthMessage, AuthShell } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
    });

    setSubmitting(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccess("If an account exists for that email, a reset link has been sent.");
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="We will email you a link to choose a new password."
      footer={
        <>
          Remember your password?{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Back to log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthMessage tone="error" message={error} />}
        {success && <AuthMessage tone="success" message={success} />}

        <AuthField
          label="Email"
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Sending..." : "Send Reset Link"}
        </button>
      </form>
    </AuthShell>
  );
}
