import { ZillowAgent } from "../types/agent.js";

export class Deduplicator {
  private seen = new Set<string>();

  private key(agent: ZillowAgent): string {
    if (agent.profileUrl) {
      return agent.profileUrl.toLowerCase();
    }
    return `${agent.fullName.toLowerCase()}|${(agent.brokerage || "").toLowerCase()}`;
  }

  filterNew(agents: ZillowAgent[]): ZillowAgent[] {
    const result: ZillowAgent[] = [];
    for (const agent of agents) {
      const k = this.key(agent);
      if (!this.seen.has(k)) {
        this.seen.add(k);
        result.push(agent);
      }
    }
    return result;
  }

  get size(): number {
    return this.seen.size;
  }
}
