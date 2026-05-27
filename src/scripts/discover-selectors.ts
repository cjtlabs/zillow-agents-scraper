import { chromium } from "playwright";
import { extractAgents } from "../parsers/agentParser.js";

/**
 * Discovery script: inspects the live Zillow agent directory page
 * to understand DOM structure, __NEXT_DATA__ format, and test parsing.
 *
 * Run with: pnpm discover
 */
async function discover() {
  const city = "los-angeles-ca";
  const url = `https://www.zillow.com/professionals/real-estate-agent-reviews/${city}/?isTopAgent=true`;

  console.log("[discover] Launching browser...");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
  });
  const page = await context.newPage();

  console.log(`[discover] Navigating to: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(3000);

  // Check for __NEXT_DATA__
  console.log("\n=== __NEXT_DATA__ Analysis ===");
  const nextDataRaw = await page.evaluate(() => {
    const el = document.querySelector("script#__NEXT_DATA__");
    return el?.textContent ?? null;
  });

  if (nextDataRaw) {
    try {
      const data = JSON.parse(nextDataRaw);
      // Show top-level keys
      console.log("Top-level keys:", Object.keys(data));
      if (data.props?.pageProps) {
        console.log("pageProps keys:", Object.keys(data.props.pageProps));
      }
      // Truncated dump to see structure
      console.log(
        "Full structure (first 3000 chars):",
        JSON.stringify(data, null, 2).slice(0, 3000)
      );
    } catch (e) {
      console.log("Failed to parse __NEXT_DATA__:", e);
    }
  } else {
    console.log("No __NEXT_DATA__ found on this page.");
  }

  // Check for profile links - show the <a> element itself as the card
  console.log("\n=== Profile Link Cards (first 5) ===");
  const profileCards = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/profile/"]');
    return Array.from(links)
      .slice(0, 5)
      .map((link) => {
        const anchor = link as HTMLAnchorElement;
        // Collect text nodes in order
        const textNodes: string[] = [];
        const walker = document.createTreeWalker(
          anchor,
          NodeFilter.SHOW_TEXT,
          null
        );
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const t = node.textContent?.trim();
          if (t) textNodes.push(t);
        }
        return {
          href: anchor.href,
          fullText: anchor.textContent?.trim().slice(0, 300),
          textNodes,
        };
      });
  });

  profileCards.forEach((card, i) => {
    console.log(`\n  Card ${i + 1}: ${card.href}`);
    console.log(`  Full text: "${card.fullText}"`);
    console.log(`  Text nodes:`, card.textNodes);
  });

  // Test the actual parser
  console.log("\n=== Parser Test (extractAgents) ===");
  try {
    const agents = await extractAgents(page, city);
    console.log(`Extracted ${agents.length} agents total.`);
    agents.slice(0, 3).forEach((agent, i) => {
      console.log(`\n  Agent ${i + 1}:`);
      console.log(`    Name: ${agent.fullName} (${agent.firstName} / ${agent.lastName})`);
      console.log(`    Brokerage: ${agent.brokerage}`);
      console.log(`    Stars: ${agent.zillowStars} (${agent.reviewCount} reviews)`);
      console.log(`    Sales 12mo: ${agent.salesLast12Months}`);
      console.log(`    Total sales: ${agent.totalTeamSales}`);
      console.log(`    Price: ${agent.minPrice} - ${agent.maxPrice}`);
      console.log(`    Profile: ${agent.profileUrl}`);
    });
  } catch (e) {
    console.error("Parser failed:", e);
  }

  // Pause for manual DevTools inspection
  console.log(
    "\n[discover] Browser is open. Use DevTools to inspect further."
  );
  console.log("[discover] Press Ctrl+C to exit.");
  await page.pause();

  await browser.close();
}

discover().catch(console.error);
