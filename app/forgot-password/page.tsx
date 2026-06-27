import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = {
  title: "Forgot Password",
  description: "Reset your AJN Marketing account password.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
