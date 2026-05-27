export interface ZillowAgent {
  firstName: string;
  lastName: string;
  fullName: string;
  brokerage?: string;
  zillowStars?: number;
  reviewCount?: number;
  salesLast12Months?: number;
  totalTeamSales?: number;
  minPrice?: string;
  maxPrice?: string;
  city: string;
  profileUrl?: string;
}

export interface ScraperConfig {
  city: string;
  topAgent: boolean;
  maxPages: number;
  headless: boolean;
  delayMs: number;
  maxRetries: number;
  outputPath: string;
  /** Enable human-like mouse simulation (v2 scraper). Default: true. */
  humanSimulation?: boolean;
}

export interface PageResult {
  agents: ZillowAgent[];
  pageNumber: number;
  hasMore: boolean;
}
