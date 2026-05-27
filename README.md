# Zillow Agents Scraper

Scrapes real estate agent data from Zillow's agent directory. Supports multiple cities, stealth browser contexts to avoid bot detection, and outputs a single deduplicated JSON file.

## Quick Start (Non-Technical Users)

Open **Terminal** and paste this:

```bash
curl -fsSL https://raw.githubusercontent.com/cjtlabs/zillow-agents-scraper/main/install-and-run.command | bash
```

This installs everything needed (Homebrew, Node.js, pnpm, Playwright) and runs the scraper. It will prompt you for city names.

## Developer Setup

```bash
git clone https://github.com/cjtlabs/zillow-agents-scraper.git
cd zillow-agents-scraper
pnpm install
pnpm exec playwright install chromium
pnpm build
```

## Usage

```bash
# Single city (defaults to los-angeles-ca)
pnpm start

# Multiple cities
pnpm start los-angeles-ca beverly-hills-ca pasadena-ca burbank-ca

# Also export as CSV
pnpm start los-angeles-ca beverly-hills-ca --csv
```

City format is `city-name-state` matching Zillow's URL pattern:
`https://www.zillow.com/professionals/real-estate-agent-reviews/{city}/`

## Output

All agents are saved to `output/agents.json` — a single file regardless of how many cities are scraped. After scraping, the data is validated and deduplicated across cities. Pass `--csv` to also generate `output/agents.csv`.

Each agent record:

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "fullName": "Jane Smith",
  "brokerage": "Example Realty",
  "zillowStars": 5,
  "reviewCount": 312,
  "salesLast12Months": 87,
  "totalTeamSales": 1420,
  "minPrice": "$250K",
  "maxPrice": "$5M",
  "city": "los-angeles-ca",
  "profileUrl": "https://www.zillow.com/profile/jane-smith/"
}
```

## How It Works

1. Launches a Chromium browser with stealth overrides (user-agent, `navigator.webdriver` hidden, Chrome runtime stubs) to bypass PerimeterX bot detection
2. Creates a fresh browser context per page to avoid cookie-based blocking
3. Extracts agent data from Zillow's `__NEXT_DATA__` JSON (falls back to DOM parsing)
4. Deduplicates within each city and across all cities after scraping
5. Saves incrementally after each page so data is never lost

## Project Structure

```
src/
├── index.ts              # Entry point — CLI arg parsing, city loop, validation
├── config.ts             # URL builder and default config
├── scraper/
│   └── zillow.ts         # Core scraper — stealth context, pagination, retry logic
├── parsers/
│   └── agentParser.ts    # Data extraction from __NEXT_DATA__ and DOM
├── types/
│   └── agent.ts          # TypeScript interfaces
└── utils/
    ├── dedup.ts           # Deduplication by profile URL or name+brokerage
    ├── delay.ts           # Randomized delays with jitter
    └── mouse.ts           # Mouse simulation utilities (bezier paths, clicks)
```
