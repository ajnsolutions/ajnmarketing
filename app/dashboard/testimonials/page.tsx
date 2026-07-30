import { redirect } from "next/navigation";
import { TestimonialsPage } from "@/components/dashboard/testimonials-page";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { listTestimonialsForUser } from "@/lib/testimonials/persistence";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Website Testimonials",
  description: "Teach the Business Brain what customers consistently value from testimonial content.",
};

export default async function TestimonialsRoute() {
  const profile = await getBusinessProfileForUser();
  if (!profile) {
    redirect("/dashboard/setup");
  }

  const supabase = await createClient();
  const testimonials = await listTestimonialsForUser(supabase, profile.user_id, profile.id);

  return <TestimonialsPage initialTestimonials={testimonials} />;
}
