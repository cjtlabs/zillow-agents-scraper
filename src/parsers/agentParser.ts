import type { Page } from "playwright";
import { ZillowAgent } from "../types/agent.js";

// ── Pure text parsers ────────────────────────────────────────────────

export function parseName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 0 || (parts.length === 1 && parts[0] === "")) {
    return { firstName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function parseReviews(text: string): {
  zillowStars?: number;
  reviewCount?: number;
} {
  const match = text.match(/(\d+(?:\.\d+)?)\s*\((\d[\d,]*)\)/);
  if (!match) return {};
  return {
    zillowStars: parseFloat(match[1]),
    reviewCount: parseInt(match[2].replace(/,/g, ""), 10),
  };
}

export function parseSalesLast12Months(text: string): number | undefined {
  const match = text.match(
    /([\d,]+)\s+(?:team\s+)?sales?\s+(?:in\s+the\s+)?last\s+12\s+months/i
  );
  return match ? parseInt(match[1].replace(/,/g, ""), 10) : undefined;
}

export function parseTotalTeamSales(
  text: string,
  city: string
): number | undefined {
  const cityDisplay = city
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+\w{2}$/, ""); // "los-angeles-ca" -> "Los Angeles"

  const escaped = cityDisplay.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `([\\d,]+)\\s+(?:team\\s+)?sales?\\s+in\\s+${escaped}`,
    "i"
  );
  const match = text.match(pattern);
  if (match) return parseInt(match[1].replace(/,/g, ""), 10);

  const fallback = text.match(/([\d,]+)\s+total\s+(?:team\s+)?sales/i);
  return fallback ? parseInt(fallback[1].replace(/,/g, ""), 10) : undefined;
}

export function parsePriceRange(text: string): {
  minPrice?: string;
  maxPrice?: string;
} {
  const match = text.match(
    /(\$[\d.]+[KMB]?)\s*[-–to]+\s*(\$[\d.]+[KMB]?)/i
  );
  if (!match) return {};
  return {
    minPrice: match[1].trim(),
    maxPrice: match[2].trim(),
  };
}

// ── __NEXT_DATA__ extraction (primary strategy) ─────────────────────

/**
 * Zillow __NEXT_DATA__ structure (discovered 2026-05-27):
 *
 * props.pageProps.displayData.agentDirectoryFinderDisplay.searchResults.results.resultsCards[]
 *
 * Each resultsCard:
 *   __typename: "AgentDirectoryFinderProfileResultsCard"
 *   cardTitle: "Tami Pardee"              (agent name)
 *   secondaryCardTitle: "Pardee Properties" (brokerage)
 *   cardActionLink: "https://..."         (profile URL)
 *   encodedZuid: "X1-..."
 *   reviewInformation: {
 *     reviewAverage: 5
 *     reviewCountFormattedText: "(1,639)"
 *   }
 *   profileData: [
 *     { formattedData: "$10K - $18M", label: "team price range" }
 *     { formattedData: "271", label: "team sales last 12 months" }
 *     { formattedData: "2,279", label: "team sales in Los Angeles" }
 *   ]
 */

function looksLikeResultsCard(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  // Match on the actual Zillow card field names
  const cardKeys = [
    "cardTitle",
    "cardActionLink",
    "encodedZuid",
    "reviewInformation",
    "profileData",
    "secondaryCardTitle",
  ];
  const matchCount = cardKeys.filter((k) => k in o).length;
  return matchCount >= 3;
}

function findResultsCards(obj: unknown, depth = 0): unknown[] | null {
  if (depth > 15) return null;
  if (Array.isArray(obj)) {
    if (obj.length > 0 && looksLikeResultsCard(obj[0])) return obj;
    for (const item of obj) {
      const found = findResultsCards(item, depth + 1);
      if (found) return found;
    }
  } else if (obj && typeof obj === "object") {
    for (const value of Object.values(obj as Record<string, unknown>)) {
      const found = findResultsCards(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function getProfileDataValue(
  profileData: Array<{ formattedData?: string; label?: string }> | undefined,
  labelPattern: RegExp
): string | undefined {
  if (!profileData) return undefined;
  const item = profileData.find((d) => d.label && labelPattern.test(d.label));
  return item?.formattedData || undefined;
}

function mapResultsCard(
  card: Record<string, any>,
  city: string
): ZillowAgent {
  const fullName = card.cardTitle || "";
  const { firstName, lastName } = parseName(fullName);

  const profileUrl = card.cardActionLink || undefined;
  const brokerage = card.secondaryCardTitle?.trim() || undefined;

  // Review information
  const reviewInfo = card.reviewInformation;
  const zillowStars =
    reviewInfo?.reviewAverage != null
      ? Number(reviewInfo.reviewAverage)
      : undefined;
  let reviewCount: number | undefined;
  if (reviewInfo?.reviewCountFormattedText) {
    const countMatch = reviewInfo.reviewCountFormattedText.match(
      /\(?([\d,]+)\)?/
    );
    if (countMatch) {
      reviewCount = parseInt(countMatch[1].replace(/,/g, ""), 10);
    }
  }

  // Profile data (price range, sales)
  const profileData = card.profileData as
    | Array<{ formattedData?: string; label?: string }>
    | undefined;

  const priceRangeRaw = getProfileDataValue(profileData, /price\s*range/i);
  const priceRange = priceRangeRaw ? parsePriceRange(priceRangeRaw) : {};

  const salesLast12Raw = getProfileDataValue(
    profileData,
    /sales?\s+last\s+12\s+months/i
  );
  const salesLast12Months = salesLast12Raw
    ? parseInt(salesLast12Raw.replace(/,/g, ""), 10)
    : undefined;

  const totalSalesRaw = getProfileDataValue(profileData, /sales?\s+in\s+/i);
  const totalTeamSales = totalSalesRaw
    ? parseInt(totalSalesRaw.replace(/,/g, ""), 10)
    : undefined;

  return {
    firstName,
    lastName,
    fullName,
    brokerage,
    zillowStars,
    reviewCount,
    salesLast12Months,
    totalTeamSales,
    ...priceRange,
    city,
    profileUrl,
  };
}

async function extractAgentsFromNextData(
  page: Page,
  city: string
): Promise<ZillowAgent[] | null> {
  const nextDataRaw = await page.evaluate(() => {
    const el = document.querySelector("script#__NEXT_DATA__");
    return el?.textContent ?? null;
  });

  if (!nextDataRaw) return null;

  try {
    const nextData = JSON.parse(nextDataRaw);
    const cards = findResultsCards(nextData);
    if (!cards || cards.length === 0) return null;

    // Filter to only actual profile result cards (skip CTA/promo cards)
    const agentCards = cards.filter((c) => {
      const card = c as Record<string, any>;
      if (card.__typename && card.__typename !== "AgentDirectoryFinderProfileResultsCard") {
        return false;
      }
      // Must have a card title that looks like a person/team name
      if (!card.cardTitle) return false;
      // Skip CTA cards like "Get help finding an agent"
      if (!card.encodedZuid && !card.reviewInformation) return false;
      return true;
    });

    if (agentCards.length === 0) return null;
    return agentCards.map((card) =>
      mapResultsCard(card as Record<string, any>, city)
    );
  } catch {
    return null;
  }
}

// ── DOM extraction (fallback strategy) ──────────────────────────────

/**
 * Parse agent data from a card's concatenated text blob.
 *
 * Zillow cards render as a single <a> element with text like:
 *   "TEAM5.0 (1,639)Tami PardeePardee Properties$10K - $18M team price range271 team sales last 12 months2,279 team sales in Los Angeles"
 *
 * The name and brokerage are extracted via the structured DOM data
 * passed alongside the text blob.
 */
export function parseAgentCardText(
  cardText: string,
  profileHref: string,
  city: string,
  nameFromDOM?: string,
  brokerageFromDOM?: string
): ZillowAgent {
  const text = cardText;

  // Use DOM-extracted name if available, otherwise try regex extraction
  let fullName = nameFromDOM || "";
  if (!fullName) {
    // Strip leading badge text (TEAM, TOP AGENT, etc.) and review pattern,
    // then try to grab the name
    const nameMatch = text.match(
      /(?:TEAM|TOP\s*AGENT)?\s*\d+(?:\.\d+)?\s*\([\d,]+\)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/
    );
    if (nameMatch) {
      fullName = nameMatch[1];
    }
  }
  const { firstName, lastName } = parseName(fullName);

  const brokerage = brokerageFromDOM || undefined;
  const reviews = parseReviews(text);
  const salesLast12 = parseSalesLast12Months(text);
  const totalSales = parseTotalTeamSales(text, city);
  const priceRange = parsePriceRange(text);

  return {
    firstName,
    lastName,
    fullName,
    brokerage,
    ...reviews,
    salesLast12Months: salesLast12,
    totalTeamSales: totalSales,
    ...priceRange,
    city,
    profileUrl: profileHref || undefined,
  };
}

async function extractAgentsFromDOM(
  page: Page,
  city: string
): Promise<ZillowAgent[]> {
  const rawCards = await page.evaluate(() => {
    // Each agent card is an <a> tag linking to /profile/
    const profileLinks = document.querySelectorAll(
      'a[href*="/profile/"]'
    );
    const results: Array<{
      text: string;
      href: string;
      name: string;
      brokerage: string;
    }> = [];

    for (const link of profileLinks) {
      const anchor = link as HTMLAnchorElement;
      const text = anchor.textContent || "";

      // Skip non-card profile links (e.g., nav links, footer links)
      // Agent cards contain review patterns or sales text
      if (!text.match(/\d+(?:\.\d+)?\s*\([\d,]+\)/) && !text.match(/sales/i)) {
        continue;
      }

      // Extract name: typically in a prominent text element.
      // Look for elements that could be a name heading within the card.
      let name = "";
      let brokerage = "";

      // Strategy: collect all text nodes in order and use structural cues.
      // The card structure is: [Badge] [Rating] [Name] [Brokerage] [Price] [Sales...]
      // Find text elements within the anchor that are likely name/brokerage
      const allText: string[] = [];
      const walker = document.createTreeWalker(
        anchor,
        NodeFilter.SHOW_TEXT,
        null
      );
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const t = node.textContent?.trim();
        if (t) allText.push(t);
      }

      // Find the name: it's after the review count ")" and before a "$" or "sales" token
      // Pattern in allText: [..., "TEAM", "5.0", "(1,639)", "Tami Pardee", "Pardee Properties", "$10K", ...]
      // Or the text nodes might be more granular
      for (let i = 0; i < allText.length; i++) {
        const t = allText[i];
        // Skip badges, ratings, and parenthetical review counts
        if (/^(TEAM|TOP\s*AGENT|SOLO)$/i.test(t)) continue;
        if (/^\d+(\.\d+)?$/.test(t)) continue;
        if (/^\([\d,]+\)$/.test(t)) continue;
        if (/^\$/.test(t)) break; // price range starts
        if (/sales/i.test(t)) break;
        if (/team price range/i.test(t)) break;

        // This is likely a name or brokerage text
        if (!name && /^[A-Z]/.test(t) && t.length > 1) {
          name = t;
        } else if (name && !brokerage && t.length > 1) {
          brokerage = t;
          break; // Got both, stop
        }
      }

      results.push({
        text,
        href: anchor.href,
        name,
        brokerage,
      });
    }

    return results;
  });

  return rawCards.map((raw) =>
    parseAgentCardText(raw.text, raw.href, city, raw.name, raw.brokerage)
  );
}

// ── Main extraction entry point ─────────────────────────────────────

export async function extractAgents(
  page: Page,
  city: string
): Promise<ZillowAgent[]> {
  // Strategy 1: __NEXT_DATA__
  const fromNextData = await extractAgentsFromNextData(page, city);
  if (fromNextData && fromNextData.length > 0) {
    console.log(
      `[parser] Extracted ${fromNextData.length} agents from __NEXT_DATA__`
    );
    return fromNextData;
  }

  // Strategy 2: DOM parsing fallback
  console.log(
    "[parser] __NEXT_DATA__ extraction failed, falling back to DOM parsing"
  );
  const fromDOM = await extractAgentsFromDOM(page, city);
  console.log(`[parser] Extracted ${fromDOM.length} agents from DOM`);
  return fromDOM;
}
