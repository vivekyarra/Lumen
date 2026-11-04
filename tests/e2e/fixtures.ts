import { test as base, expect, Page } from "@playwright/test";

/** Opens the web preview in test mode (virtual Lens clock) and fails on any page error. */
export const test = base.extend<{ lens: Page }>({
  lens: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto("/?test");
    await page.waitForFunction(() => (window as any).lumen);
    await use(page);
    expect(errors, "no page errors").toEqual([]);
  },
});
export { expect };
