import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Log In",
  description: "Log in to your AJN Marketing dashboard.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
