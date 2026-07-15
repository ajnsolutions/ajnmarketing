import { test, expect } from "@playwright/test";

test.describe("interactive demo", () => {
  test.setTimeout(60_000);

  test("interactive demo page renders form", async ({ page }) => {
    await page.goto("/ai-demo", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle(/Interactive AI Marketing Demo|AJN Marketing/);
    await expect(
      page.getByRole("heading", {
        name: /Experience AJN Marketing before you sign up/i,
      }),
    ).toBeVisible();
    await expect(page.getByLabel(/Website URL/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /See What AJN Would Do/i }),
    ).toBeVisible();
  });

  test("interactive demo requires a website URL", async ({ page }) => {
    await page.goto("/ai-demo", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /See What AJN Would Do/i }).click();
    // Native HTML5 validation should keep the user on the form.
    await expect(page.getByLabel(/Website URL/i)).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /See exactly what AJN would do for your business/i,
      }),
    ).toBeVisible();
  });
});
