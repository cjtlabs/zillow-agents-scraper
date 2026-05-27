import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "./config.js";
import { ZillowScraper } from "./scraper/zillow.js";
import { ZillowAgent } from "./types/agent.js";
import { Deduplicator } from "./utils/dedup.js";

const DEFAULT_CITIES = ["los-angeles-ca"];
const OUTPUT_PATH = "output/agents.json";
const CSV_PATH = "output/agents.csv";

function writeOutput(agents: ZillowAgent[], outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(agents, null, 2), "utf-8");
}

function writeCsv(agents: ZillowAgent[], csvPath: string): void {
  const headers = [
    "firstName",
    "lastName",
    "fullName",
    "brokerage",
    "zillowStars",
    "reviewCount",
    "salesLast12Months",
    "totalTeamSales",
    "minPrice",
    "maxPrice",
    "city",
    "profileUrl",
  ];

  const escape = (val: string | number | undefined): string => {
    if (val == null) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = agents.map((a) =>
    headers.map((h) => escape(a[h as keyof ZillowAgent])).join(",")
  );

  const dir = path.dirname(csvPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(csvPath, [headers.join(","), ...rows].join("\n"), "utf-8");
}

/** Drop agents missing critical fields. */
function validate(agents: ZillowAgent[]): ZillowAgent[] {
  return agents.filter((a) => {
    if (!a.fullName || !a.fullName.trim()) {
      console.warn(`[validate] Dropping agent with missing name (profile: ${a.profileUrl})`);
      return false;
    }
    if (!a.city || !a.city.trim()) {
      console.warn(`[validate] Dropping agent with missing city: ${a.fullName}`);
      return false;
    }
    return true;
  });
}

async function scrapeCity(
  city: string,
  allAgents: ZillowAgent[]
): Promise<ZillowAgent[]> {
  const config = loadConfig({
    city,
    outputPath: OUTPUT_PATH,
  });

  console.log(`\n[zillow-scraper] ── Scraping ${city} ──`);

  const scraper = new ZillowScraper(config, (agents, pageNum) => {
    writeOutput([...allAgents, ...agents], OUTPUT_PATH);
    console.log(
      `[output] Saved ${allAgents.length + agents.length} agents to ${OUTPUT_PATH} (${city} page ${pageNum})`
    );
  });

  try {
    await scraper.init();
    return await scraper.scrapeAll();
  } finally {
    await scraper.close();
  }
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const csv = rawArgs.includes("--csv");
  const cities = rawArgs.filter((a) => !a.startsWith("--"));

  if (cities.length === 0) {
    cities.push(...DEFAULT_CITIES);
  }

  console.log(`[zillow-scraper] Starting — ${cities.length} city(ies): ${cities.join(", ")}`);

  let allAgents: ZillowAgent[] = [];

  for (const city of cities) {
    try {
      const cityAgents = await scrapeCity(city, allAgents);
      allAgents.push(...cityAgents);
      console.log(`[zillow-scraper] ${city}: ${cityAgents.length} agents scraped`);
    } catch (error) {
      console.error(`[zillow-scraper] Fatal error scraping ${city}:`, error);
    }
  }

  // Final validation + cross-city dedup
  console.log(`\n[zillow-scraper] Post-processing ${allAgents.length} agents...`);

  allAgents = validate(allAgents);
  console.log(`[zillow-scraper] After validation: ${allAgents.length}`);

  const dedup = new Deduplicator();
  allAgents = dedup.filterNew(allAgents);
  console.log(`[zillow-scraper] After dedup: ${allAgents.length}`);

  writeOutput(allAgents, OUTPUT_PATH);
  console.log(`[zillow-scraper] All done. ${allAgents.length} agents saved to ${OUTPUT_PATH}`);

  if (csv) {
    writeCsv(allAgents, CSV_PATH);
    console.log(`[zillow-scraper] CSV saved to ${CSV_PATH}`);
  }
}

main();
