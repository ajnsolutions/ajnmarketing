import { redirect } from "next/navigation";

export const metadata = {
  title: "Library",
  description: "Everything we've created together — content, posts, and brand assets.",
};

/** Canonical customer destination is Library; keep this route for deep links. */
export default function ContentRoute() {
  redirect("/dashboard/library");
}
