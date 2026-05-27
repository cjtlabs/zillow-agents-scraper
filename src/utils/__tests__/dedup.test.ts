import { describe, it, expect } from "vitest";
import { Deduplicator } from "../dedup.js";
import { ZillowAgent } from "../../types/agent.js";

function makeAgent(overrides: Partial<ZillowAgent> = {}): ZillowAgent {
  return {
    firstName: "Test",
    lastName: "Agent",
    fullName: "Test Agent",
    city: "los-angeles-ca",
    ...overrides,
  };
}

describe("Deduplicator", () => {
  it("filters duplicates by profileUrl", () => {
    const dedup = new Deduplicator();
    const agents = [
      makeAgent({ profileUrl: "https://zillow.com/profile/a" }),
      makeAgent({ profileUrl: "https://zillow.com/profile/a" }),
    ];
    expect(dedup.filterNew(agents)).toHaveLength(1);
  });

  it("is case-insensitive for profileUrl", () => {
    const dedup = new Deduplicator();
    const agents = [
      makeAgent({ profileUrl: "https://zillow.com/profile/A" }),
      makeAgent({ profileUrl: "https://zillow.com/profile/a" }),
    ];
    expect(dedup.filterNew(agents)).toHaveLength(1);
  });

  it("filters duplicates by name+brokerage when no profileUrl", () => {
    const dedup = new Deduplicator();
    const agents = [
      makeAgent({ fullName: "John Smith", brokerage: "Remax" }),
      makeAgent({ fullName: "John Smith", brokerage: "Remax" }),
    ];
    expect(dedup.filterNew(agents)).toHaveLength(1);
  });

  it("allows different agents through", () => {
    const dedup = new Deduplicator();
    const agents = [
      makeAgent({ profileUrl: "https://zillow.com/profile/a" }),
      makeAgent({ profileUrl: "https://zillow.com/profile/b" }),
    ];
    expect(dedup.filterNew(agents)).toHaveLength(2);
  });

  it("tracks size correctly", () => {
    const dedup = new Deduplicator();
    dedup.filterNew([
      makeAgent({ profileUrl: "https://zillow.com/profile/a" }),
      makeAgent({ profileUrl: "https://zillow.com/profile/b" }),
    ]);
    expect(dedup.size).toBe(2);
  });

  it("remembers across multiple filterNew calls", () => {
    const dedup = new Deduplicator();
    dedup.filterNew([
      makeAgent({ profileUrl: "https://zillow.com/profile/a" }),
    ]);
    const result = dedup.filterNew([
      makeAgent({ profileUrl: "https://zillow.com/profile/a" }),
      makeAgent({ profileUrl: "https://zillow.com/profile/b" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].profileUrl).toBe("https://zillow.com/profile/b");
  });
});
