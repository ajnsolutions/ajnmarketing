"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthField, AuthMessage, AuthShell } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          business_name: businessName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });

    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.push("/onboarding");
      router.refresh();
      return;
    }

    setSuccess("Check your email to confirm your account, then log in.");
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Start managing your local marketing with AJN AI."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthMessage tone="error" message={error} />}
        {success && <AuthMessage tone="success" message={success} />}

        <AuthField label="Name" id="name" autoComplete="name" value={name} onChange={setName} />

        <AuthField
          label="Business name"
          id="business-name"
          autoComplete="organization"
          value={businessName}
          onChange={setBusinessName}
        />

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
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating account..." : "Create Account"}
        </button>
      </form>
    </AuthShell>
  );
}
