import * as fs from "node:fs";
import { ZillowAgent } from "../types/agent.js";

const data = fs.readFileSync("output/agents.json", "utf8");
const agents: ZillowAgent[] = JSON.parse(data);

console.log("Total agents:", agents.length);
console.log("Have names:", agents.filter((x) => x.fullName).length);
console.log("Have brokerages:", agents.filter((x) => x.brokerage).length);
console.log("Have stars:", agents.filter((x) => x.zillowStars != null).length);
console.log("Have reviews:", agents.filter((x) => x.reviewCount != null).length);
console.log("Have salesLast12:", agents.filter((x) => x.salesLast12Months != null).length);
console.log("Have totalSales:", agents.filter((x) => x.totalTeamSales != null).length);
console.log("Have priceRange:", agents.filter((x) => x.minPrice).length);
console.log("Have profileUrl:", agents.filter((x) => x.profileUrl).length);

// Check for duplicates
const profileUrls = agents.filter((x) => x.profileUrl).map((x) => x.profileUrl);
const uniqueUrls = new Set(profileUrls);
console.log("\nDuplicate check:");
console.log("  Unique profile URLs:", uniqueUrls.size, "of", profileUrls.length);

// Show last 3 agents
console.log("\nLast 3 agents:");
agents.slice(-3).forEach((a, i) => {
  console.log(`  ${agents.length - 2 + i}. ${a.fullName} | ${a.brokerage} | ${a.zillowStars}★ (${a.reviewCount}) | ${a.salesLast12Months} sales`);
});
