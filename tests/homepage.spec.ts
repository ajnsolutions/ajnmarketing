import { test, expect } from "@playwright/test";

test("homepage renders phase-1 messaging", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/AJN Marketing/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Stop worrying about marketing",
  );
  await expect(
    page.getByRole("link", { name: "Get Started" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /marketing employee/i }).first(),
  ).toBeVisible();
});

test("primary nav includes Features About Contact", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Features" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "About" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Contact" })).toBeVisible();
});
