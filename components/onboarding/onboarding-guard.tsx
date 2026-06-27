"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isOnboardingComplete } from "@/lib/onboarding-storage";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isOnboardingComplete()) {
      setAllowed(true);
      return;
    }

    router.replace("/onboarding");
  }, [router]);

  if (!allowed) {
    return null;
  }

  return children;
}
