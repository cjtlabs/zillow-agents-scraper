# Zillow Top Agents Scraper PRD

## Overview

Build a configurable Zillow scraper using Playwright that extracts publicly visible real estate agent information from Zillow agent directory pages.

Initial scope focuses on:

* Los Angeles, CA
* Top Agents only

The architecture must support:

* any city
* top-agent or normal-agent searches
* future multi-city scaling
* future enrichment pipelines

The scraper will use SSR-rendered Zillow pages instead of relying on unstable frontend interactions or reverse-engineered APIs.

Primary output format will be CSV.

---

# Goals

## Primary Goals

Extract the following fields:

| Field                | Required |
| -------------------- | -------- |
| first_name           | yes      |
| last_name            | yes      |
| full_name            | yes      |
| brokerage            | yes      |
| zillow_stars         | yes      |
| review_count         | yes      |
| sales_last_12_months | yes      |
| total_team_sales     | yes      |
| min_price_range      | optional |
| max_price_range      | optional |
| city                 | yes      |
| profile_url          | optional |

---

# Non-Goals

Not included in MVP:

* email extraction
* phone extraction
* CAPTCHA solving
* proxy rotation
* GraphQL reverse engineering
* distributed scraping
* browser clustering
* anti-detection hardening
* data enrichment
* CRM integration
* scheduling/orchestration

---

# Scope

## Included

* Playwright scraper
* SSR DOM extraction
* configurable city support
* configurable top-agent filtering
* pagination support
* CSV export
* duplicate prevention
* configurable runtime settings

## Excluded

* authenticated Zillow scraping
* hidden/private data
* contact enrichment
* Zillow API integration
* cloud deployment

---

# Target URLs

## Base Format

```text id="mjlwmj"
https://www.zillow.com/professionals/real-estate-agent-reviews/{city}/
```

## Examples

Top agents:

```text id="63v4t8"
https://www.zillow.com/professionals/real-estate-agent-reviews/los-angeles-ca/?isTopAgent=true
```

Paginated:

```text id="m7evn6"
https://www.zillow.com/professionals/real-estate-agent-reviews/los-angeles-ca/?page=2&isTopAgent=true
```

Normal agents:

```text id="qu1mpv"
https://www.zillow.com/professionals/real-estate-agent-reviews/los-angeles-ca/
```

---

# Functional Requirements

## FR-1 Configurable Scraper

The scraper must support:

* configurable city
* configurable top-agent mode
* configurable max pages
* configurable headless mode
* configurable delays

Example config:

```json id="1tyh2m"
{
  "city": "los-angeles-ca",
  "topAgent": true,
  "maxPages": 100,
  "headless": false,
  "delayMs": 3000
}
```

---

## FR-2 URL Pagination

The scraper must paginate using URL parameters instead of button clicking.

Supported params:

* `page`
* `isTopAgent`

Example:

```text id="e0tkr2"
?page=3&isTopAgent=true
```

---

## FR-3 Agent Card Extraction

The scraper must:

1. load Zillow page
2. wait for SSR content
3. extract agent cards
4. parse structured data
5. normalize results

---

## FR-4 Duplicate Prevention

The scraper must prevent duplicate records using:

* profile URL if available
  OR
* full_name + brokerage

---

## FR-5 Empty Page Detection

The scraper must stop automatically when:

* no agent cards are found
  OR
* repeated pages detected
  OR
* max pages reached

---

## FR-6 CSV Export

The scraper must export results into CSV format.

Output file example:

```text id="p1c6n0"
output/agents.csv
```

CSV columns:

```text id="n4t3uk"
first_name
last_name
full_name
brokerage
zillow_stars
review_count
sales_last_12_months
total_team_sales
min_price_range
max_price_range
city
profile_url
```

---

# Data Model

## ZillowAgent

```ts id="84p22q"
interface ZillowAgent {
  firstName: string
  lastName: string
  fullName: string

  brokerage?: string

  zillowStars?: number
  reviewCount?: number

  salesLast12Months?: number
  totalTeamSales?: number

  minPrice?: string
  maxPrice?: string

  city: string

  profileUrl?: string
}
```

---

# Parsing Rules

## Name Parsing

Input:

```text id="6eiygv"
Tami Pardee
```

Output:

```json id="tddzjlwm"
{
  "firstName": "Tami",
  "lastName": "Pardee"
}
```

---

## Review Parsing

Input:

```text id="o1ww4t"
5.0 (1,639)
```

Output:

```json id="xvjv38"
{
  "zillowStars": 5.0,
  "reviewCount": 1639
}
```

---

## Sales Parsing

Input:

```text id="k2nvyx"
271 team sales last 12 months
```

Output:

```json id="gv4r1x"
{
  "salesLast12Months": 271
}
```

Input:

```text id="rl57s7"
2,279 team sales in Los Angeles
```

Output:

```json id="jlwmg6"
{
  "totalTeamSales": 2279
}
```

---

# Technical Requirements

## Stack

| Component  | Technology |
| ---------- | ---------- |
| Runtime    | Node.js    |
| Language   | TypeScript |
| Scraper    | Playwright |
| CSV Export | csv-writer |

---

# Suggested Project Structure

```text id="j9o6xf"
src/
  config.ts
  index.ts

  scraper/
    zillow.ts

  parsers/
    agentParser.ts

  exporters/
    csv.ts

  types/
    agent.ts

output/
  agents.csv
```

---

# CSV Export Requirements

## Library

Use:

```bash id="x5mjlwm"
npm install csv-writer
```

---

## CSV Exporter

Example implementation:

```ts id="ycs99n"
import { createObjectCsvWriter }
from 'csv-writer'

const csvWriter = createObjectCsvWriter({
  path: 'output/agents.csv',

  header: [
    { id: 'firstName', title: 'FIRST_NAME' },
    { id: 'lastName', title: 'LAST_NAME' },
    { id: 'fullName', title: 'FULL_NAME' },

    { id: 'brokerage', title: 'BROKERAGE' },

    { id: 'zillowStars', title: 'ZILLOW_STARS' },
    { id: 'reviewCount', title: 'REVIEW_COUNT' },

    {
      id: 'salesLast12Months',
      title: 'SALES_LAST_12_MONTHS'
    },

    {
      id: 'totalTeamSales',
      title: 'TOTAL_TEAM_SALES'
    },

    { id: 'minPrice', title: 'MIN_PRICE' },
    { id: 'maxPrice', title: 'MAX_PRICE' },

    { id: 'city', title: 'CITY' },

    {
      id: 'profileUrl',
      title: 'PROFILE_URL'
    }
  ]
})
```

---

# Scraping Strategy

## MVP Strategy

Use:

* SSR-rendered DOM extraction
* URL-based pagination

Avoid:

* button clicking
* infinite scroll handling
* GraphQL replay
* HAR replay

Reason:
Zillow already exposes structured agent data in rendered HTML.

---

# Selector Strategy

Avoid:

* brittle CSS module class names

Prefer:

* semantic text matching
* structural extraction
* resilient traversal

---

# Anti-Blocking Strategy

## Initial MVP Strategy

Use:

* sequential scraping
* persistent browser session
* randomized delays
* real Chrome browser
* low concurrency

Avoid:

* aggressive parallelism
* datacenter-scale scraping

Expected scale:

* ~2,000 LA top agents

Expected risk:

* low

---

# Error Handling

## Retry Conditions

Retry page when:

* navigation timeout
* temporary 403
* empty SSR render

Max retries:

* 3 per page

---

# Performance Requirements

## Initial Scale

Target:

* Los Angeles only
* ~2,000 agents

Expected runtime:

* under 15 minutes without concurrency

---

# Future Scalability

Architecture should support:

* parallel page scraping
* proxy rotation
* queue systems
* multi-city scraping
* enrichment pipelines
* Supabase/Postgres ingestion
* distributed workers

---

# Risks

| Risk                      | Impact      |
| ------------------------- | ----------- |
| Zillow anti-bot detection | medium      |
| selector changes          | medium      |
| SSR structure changes     | medium      |
| rate limiting             | low         |
| CAPTCHA                   | low for MVP |

---

# Future Enhancements

## Phase 2

* email enrichment
* phone extraction
* profile-page scraping
* Apollo/Hunter integration
* proxy rotation
* concurrency

## Phase 3

* GraphQL/API interception
* distributed scraping
* Supabase ingestion
* scheduled jobs
* CRM integrations

---

# Acceptance Criteria

## AC-1

Scraper successfully extracts:

* names
* brokerage
* ratings
* review counts
* sales metrics

from Zillow Los Angeles Top Agents pages.

---

## AC-2

Scraper paginates automatically until no pages remain.

---

## AC-3

Scraper exports valid CSV output.

---

## AC-4

Scraper prevents duplicate agent entries.

---

## AC-5

Scraper supports configurable:

* city
* top-agent filtering
* page limits

---

# Example CSV Output

```csv id="br5b0s"
FIRST_NAME,LAST_NAME,FULL_NAME,BROKERAGE,ZILLOW_STARS,REVIEW_COUNT,SALES_LAST_12_MONTHS,TOTAL_TEAM_SALES,MIN_PRICE,MAX_PRICE,CITY,PROFILE_URL
Tami,Pardee,Tami Pardee,Pardee Properties,5,1639,271,2279,$10K,$18M,los-angeles-ca,https://www.zillow.com/profile/...
Stephanie,Younger,Stephanie Younger,COMPASS,5,880,215,1734,$261K,$7.7M,los-angeles-ca,https://www.zillow.com/profile/...
```
