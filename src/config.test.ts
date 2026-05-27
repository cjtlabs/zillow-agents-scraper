import { describe, it, expect } from "vitest";
import { loadConfig, buildUrl } from "./config.js";

describe("loadConfig", () => {
  it("returns defaults when no overrides", () => {
    const config = loadConfig();
    expect(config.city).toBe("los-angeles-ca");
    expect(config.topAgent).toBe(true);
    expect(config.maxPages).toBe(25);
    expect(config.headless).toBe(false);
    expect(config.delayMs).toBe(8000);
    expect(config.maxRetries).toBe(5);
    expect(config.outputPath).toBe("output/agents.json");
  });

  it("merges overrides", () => {
    const config = loadConfig({ city: "new-york-ny", maxPages: 10 });
    expect(config.city).toBe("new-york-ny");
    expect(config.maxPages).toBe(10);
    expect(config.topAgent).toBe(true); // default preserved
  });
});

describe("buildUrl", () => {
  const baseConfig = loadConfig();

  it("builds page 1 URL with topAgent", () => {
    const url = buildUrl(baseConfig, 1);
    expect(url).toBe(
      "https://www.zillow.com/professionals/real-estate-agent-reviews/los-angeles-ca/?isTopAgent=true"
    );
  });

  it("builds paginated URL", () => {
    const url = buildUrl(baseConfig, 3);
    expect(url).toBe(
      "https://www.zillow.com/professionals/real-estate-agent-reviews/los-angeles-ca/?page=3&isTopAgent=true"
    );
  });

  it("builds URL without topAgent", () => {
    const config = loadConfig({ topAgent: false });
    const url = buildUrl(config, 1);
    expect(url).toBe(
      "https://www.zillow.com/professionals/real-estate-agent-reviews/los-angeles-ca/"
    );
  });

  it("builds URL for different city", () => {
    const config = loadConfig({ city: "new-york-ny" });
    const url = buildUrl(config, 2);
    expect(url).toContain("new-york-ny");
    expect(url).toContain("page=2");
  });
});
