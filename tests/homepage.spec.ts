import { test, expect } from "@playwright/test";

test("homepage renders", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/AJN Marketing/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("More Visibility");
  await expect(page.getByText("Local Marketing That Delivers Results")).toBeVisible();
});
