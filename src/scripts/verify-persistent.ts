import { chromium } from "playwright";

async function verify() {
  const context = await chromium.launchPersistentContext("./zillow-profile", {
    headless: false,
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  console.log("Loading page 1...");
  await page.goto(
    "https://www.zillow.com/professionals/real-estate-agent-reviews/los-angeles-ca/?isTopAgent=true",
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForTimeout(5000);

  const count1 = await page.evaluate(
    () => document.querySelectorAll('a[href*="/profile/"]').length
  );
  console.log("Page 1 agents:", count1);

  console.log("Loading page 2...");
  await page.goto(
    "https://www.zillow.com/professionals/real-estate-agent-reviews/los-angeles-ca/?page=2&isTopAgent=true",
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForTimeout(5000);

  const count2 = await page.evaluate(
    () => document.querySelectorAll('a[href*="/profile/"]').length
  );
  console.log("Page 2 agents:", count2);

  await context.close();
}

verify().catch(console.error);
