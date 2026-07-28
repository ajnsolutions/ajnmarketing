import { Suspense } from "react";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = {
  title: "Sign Up",
  description: "Create your AJN Marketing account.",
};

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}
