import { ScraperConfig } from "./types/agent.js";

const DEFAULT_CONFIG: ScraperConfig = {
  city: "los-angeles-ca",
  topAgent: true,
  maxPages: 25,
  headless: false,
  delayMs: 8000,
  maxRetries: 5,
  outputPath: "output/agents.json",
};

export function loadConfig(
  overrides?: Partial<ScraperConfig>
): ScraperConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

export function buildUrl(config: ScraperConfig, page: number): string {
  const base = `https://www.zillow.com/professionals/real-estate-agent-reviews/${config.city}/`;
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (config.topAgent) params.set("isTopAgent", "true");
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
