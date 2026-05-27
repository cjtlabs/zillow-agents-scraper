import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "./config.js";
import { ZillowScraper } from "./scraper/zillow.js";
import { ZillowAgent } from "./types/agent.js";
import { Deduplicator } from "./utils/dedup.js";

const DEFAULT_CITIES = ["los-angeles-ca"];
const OUTPUT_PATH = "output/agents.json";

function writeOutput(agents: ZillowAgent[], outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(agents, null, 2), "utf-8");
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
  const args = process.argv.slice(2);
  const cities = args.length > 0 ? args : DEFAULT_CITIES;

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
}

main();
