import { chromium, Browser, BrowserContext, Page, Locator } from "playwright";
import { ScraperConfig, ZillowAgent, PageResult } from "../types/agent.js";
import { buildUrl } from "../config.js";
import { extractAgents } from "../parsers/agentParser.js";
import { randomDelay } from "../utils/delay.js";
import { Deduplicator } from "../utils/dedup.js";
import { resetCursorPosition } from "../utils/mouse.js";

export type OnPageComplete = (agents: ZillowAgent[], pageNumber: number) => void;

// Stealth: realistic Chrome user-agent
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/** Inject stealth overrides so the page doesn't look like Playwright. */
const STEALTH_SCRIPT = `
  // Hide webdriver flag
  Object.defineProperty(navigator, 'webdriver', { get: () => false });

  // Fake plugins (real Chrome has at least a few)
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
  });

  // Fake languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  });

  // Chrome runtime stub (PerimeterX checks for this)
  if (!window.chrome) {
    window.chrome = { runtime: {} };
  }

  // Permissions query override (Playwright returns 'denied' for notifications)
  const origQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (params) =>
    params.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission })
      : origQuery(params);
`;

export class ZillowScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: ScraperConfig;
  private dedup: Deduplicator;
  private onPageComplete?: OnPageComplete;

  constructor(config: ScraperConfig, onPageComplete?: OnPageComplete) {
    this.config = config;
    this.dedup = new Deduplicator();
    this.onPageComplete = onPageComplete;
  }

  /** Create a stealth browser context with anti-detection overrides. */
  private async createStealthContext(): Promise<{
    context: BrowserContext;
    page: Page;
  }> {
    const context = await this.browser!.newContext({
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
      userAgent: USER_AGENT,
    });
    await context.addInitScript(STEALTH_SCRIPT);
    const page = await context.newPage();
    return { context, page };
  }

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
      ],
    });
    const { context, page } = await this.createStealthContext();
    this.context = context;
    this.page = page;
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
  }

  // ── Anti-bot helpers ─────────────────────────────────────────────

  /** Destroy context and start fresh with stealth. */
  private async freshContext(): Promise<void> {
    await this.context?.close();
    const { context, page } = await this.createStealthContext();
    this.context = context;
    this.page = page;
    resetCursorPosition();
  }

  // ── Page scraping ────────────────────────────────────────────────

  private async scrapePage(pageNumber: number): Promise<PageResult> {
    const url = buildUrl(this.config, pageNumber);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(
          `[scraper] Page ${pageNumber}, attempt ${attempt}: ${url}`
        );

        // Fresh stealth context on every retry (and on attempt 1 for pages > 1)
        if ((attempt > 1 || pageNumber > 1) && this.browser) {
          await this.freshContext();
        }

        const response = await this.page!.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });

        const status = response?.status() ?? 0;
        if (status === 403 || status === 429) {
          console.warn(
            `[scraper] Received ${status} on page ${pageNumber}`
          );
          console.log(
            `[scraper] Waiting for potential anti-bot challenge to resolve...`
          );
          await this.page!.waitForTimeout(8000);

          const hasContent = await this.page!.evaluate(() => {
            return (
              !!document.querySelector("script#__NEXT_DATA__") ||
              document.querySelectorAll('a[href*="/profile/"]').length > 0
            );
          });

          if (hasContent) {
            console.log(`[scraper] Challenge resolved, proceeding...`);
          } else {
            if (attempt < this.config.maxRetries) {
              const backoffMs = this.config.delayMs * 3 * attempt;
              console.log(
                `[scraper] Challenge not resolved. Backing off ${Math.round(backoffMs / 1000)}s...`
              );
              await randomDelay(backoffMs);
              continue;
            }
            throw new Error(
              `Blocked with status ${status} after ${attempt} attempts`
            );
          }
        }

        // Wait for hydration
        await this.page!.waitForTimeout(2000);

        const agents = await extractAgents(this.page!, this.config.city);
        return { agents, pageNumber, hasMore: agents.length > 0 };
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error(String(error));
        console.error(
          `[scraper] Attempt ${attempt} failed: ${lastError.message}`
        );
        if (attempt < this.config.maxRetries) {
          await randomDelay(this.config.delayMs * attempt);
        }
      }
    }

    console.error(
      `[scraper] All ${this.config.maxRetries} attempts failed for page ${pageNumber}`
    );
    return { agents: [], pageNumber, hasMore: false };
  }

  // ── Main scraping loop ───────────────────────────────────────────

  async scrapeAll(): Promise<ZillowAgent[]> {
    const allAgents: ZillowAgent[] = [];
    let previousPageHash = "";
    let consecutiveEmpty = 0;
    const MAX_CONSECUTIVE_EMPTY = 3;

    for (let pageNum = 1; pageNum <= this.config.maxPages; pageNum++) {
      const result = await this.scrapePage(pageNum);

      // Empty page detection
      if (result.agents.length === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
          console.log(
            `[scraper] ${MAX_CONSECUTIVE_EMPTY} consecutive empty pages. Stopping.`
          );
          break;
        }
        console.log(
          `[scraper] No agents on page ${pageNum} (${consecutiveEmpty}/${MAX_CONSECUTIVE_EMPTY} empty). Continuing...`
        );
        continue;
      }
      consecutiveEmpty = 0;

      // Repeated page detection
      const currentPageHash = result.agents
        .map((a) => a.profileUrl || a.fullName)
        .sort()
        .join("|");
      if (currentPageHash === previousPageHash) {
        console.log(
          `[scraper] Page ${pageNum} is identical to previous. Stopping.`
        );
        break;
      }
      previousPageHash = currentPageHash;

      // Deduplicate
      const newAgents = this.dedup.filterNew(result.agents);
      allAgents.push(...newAgents);

      console.log(
        `[scraper] Page ${pageNum}: ${result.agents.length} found, ` +
          `${newAgents.length} new, ${allAgents.length} total`
      );

      // Flush to disk after each page
      this.onPageComplete?.(allAgents, pageNum);
    }

    return allAgents;
  }
}
