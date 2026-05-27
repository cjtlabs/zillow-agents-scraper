import type { Page, Locator } from "playwright";
import { microDelay } from "./delay.js";

// ── Types ────────────────────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
}

// ── Internal state ───────────────────────────────────────────────────

const VIEWPORT = { width: 1280, height: 800 };
let cursorPos: Point = { x: 0, y: 0 };

/** Reset internal cursor tracker (call after page navigation or fresh context). */
export function resetCursorPosition(): void {
  cursorPos = { x: 0, y: 0 };
}

// ── Pure math helpers ────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Random jitter scaled by movement distance.
 * Short moves (<100px) get small offsets; long moves (>500px) get larger ones.
 */
export function randomOffset(distance: number): number {
  const scale = clamp(distance / 500, 0.1, 1.0);
  const maxOffset = 50 * scale;
  return (Math.random() - 0.5) * 2 * maxOffset;
}

/**
 * Generate a cubic bezier curve path between two points.
 * Control points are randomly offset to create natural-looking curves.
 */
export function bezierPath(from: Point, to: Point, steps?: number): Point[] {
  const n = steps ?? randomInt(20, 40);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Control points at ~25% and ~75% of the path with random offsets
  const cp1: Point = {
    x: from.x + dx * 0.25 + randomOffset(dist),
    y: from.y + dy * 0.25 + randomOffset(dist),
  };
  const cp2: Point = {
    x: from.x + dx * 0.75 + randomOffset(dist),
    y: from.y + dy * 0.75 + randomOffset(dist),
  };

  const points: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const u = 1 - t;
    points.push({
      x: Math.round(
        u * u * u * from.x +
          3 * u * u * t * cp1.x +
          3 * u * t * t * cp2.x +
          t * t * t * to.x
      ),
      y: Math.round(
        u * u * u * from.y +
          3 * u * u * t * cp1.y +
          3 * u * t * t * cp2.y +
          t * t * t * to.y
      ),
    });
  }
  return points;
}

// ── Mouse movement ───────────────────────────────────────────────────

/**
 * Move the mouse from its current position to (x, y) along a bezier curve.
 */
export async function moveTo(page: Page, x: number, y: number): Promise<void> {
  const targetX = clamp(Math.round(x), 0, VIEWPORT.width - 1);
  const targetY = clamp(Math.round(y), 0, VIEWPORT.height - 1);

  const path = bezierPath(cursorPos, { x: targetX, y: targetY });
  for (const pt of path) {
    await page.mouse.move(
      clamp(pt.x, 0, VIEWPORT.width - 1),
      clamp(pt.y, 0, VIEWPORT.height - 1)
    );
    await microDelay(2, 8);
  }

  cursorPos = { x: targetX, y: targetY };
}

// ── Human click ──────────────────────────────────────────────────────

/**
 * Simulate a human click on an element.
 * Moves along a bezier path to a random point within the element's bounding box,
 * pauses briefly, then clicks with a realistic down/up delay.
 */
export async function humanClick(
  page: Page,
  target: string | Locator
): Promise<void> {
  const locator =
    typeof target === "string" ? page.locator(target).first() : target;

  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(
      `humanClick: element not visible (selector: ${typeof target === "string" ? target : "Locator"})`
    );
  }

  // Random point inside the box, avoiding the very edges (20-80% range)
  const clickX = box.x + box.width * (0.2 + Math.random() * 0.6);
  const clickY = box.y + box.height * (0.2 + Math.random() * 0.6);

  await moveTo(page, clickX, clickY);
  await microDelay(50, 150); // pre-click dwell
  await page.mouse.click(clickX, clickY, { delay: randomInt(50, 100) });
}

// ── Scrolling ────────────────────────────────────────────────────────

interface ScrollOptions {
  /** Total distance to scroll in pixels. Defaults to remaining page height (capped at 3000). */
  distance?: number;
}

/**
 * Scroll the page gradually, simulating a human reading through content.
 */
export async function scrollPage(
  page: Page,
  options?: ScrollOptions
): Promise<void> {
  let remaining =
    options?.distance ??
    Math.min(
      await page.evaluate(
        () => document.body.scrollHeight - window.innerHeight
      ),
      3000
    );

  while (remaining > 0) {
    const increment = randomInt(80, 200);
    const actual = Math.min(increment, remaining);
    await page.mouse.wheel(0, actual);
    remaining -= actual;

    // Normal reading pause
    await microDelay(100, 400);

    // Occasionally pause longer (20% chance) to "read" a section
    if (Math.random() < 0.2) {
      await microDelay(500, 1500);
    }
  }

  await microDelay(200, 500);
}

// ── Hover over agent cards ───────────────────────────────────────────

/**
 * Hover over a random subset of elements matching the selector.
 */
export async function hoverRandomCards(
  page: Page,
  selector: string,
  count?: number
): Promise<void> {
  const elements = await page.locator(selector).all();
  if (elements.length < 2) return;

  const n = Math.min(count ?? randomInt(2, 5), elements.length);

  // Fisher-Yates shuffle to pick random indices
  const indices = elements.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const selected = indices.slice(0, n);

  for (const idx of selected) {
    const box = await elements[idx].boundingBox();
    if (!box) continue;

    // Move to a random point within the card
    const hoverX = box.x + box.width * (0.2 + Math.random() * 0.6);
    const hoverY = box.y + box.height * (0.2 + Math.random() * 0.6);
    await moveTo(page, hoverX, hoverY);

    // Dwell on the card (reading it)
    await microDelay(300, 800);

    // 30% chance of small jitter while hovering
    if (Math.random() < 0.3) {
      await moveTo(page, hoverX + randomInt(-5, 5), hoverY + randomInt(-5, 5));
      await microDelay(100, 300);
    }
  }
}

// ── Idle movement ────────────────────────────────────────────────────

/**
 * Small random mouse drift near the current position (50% chance of doing nothing).
 */
export async function idleMovement(page: Page): Promise<void> {
  if (Math.random() < 0.5) return;

  const drift = randomInt(50, 150);
  const angle = Math.random() * 2 * Math.PI;
  const newX = clamp(
    cursorPos.x + Math.cos(angle) * drift,
    0,
    VIEWPORT.width - 1
  );
  const newY = clamp(
    cursorPos.y + Math.sin(angle) * drift,
    0,
    VIEWPORT.height - 1
  );

  await moveTo(page, newX, newY);
  await microDelay(200, 600);
}

// ── Composite page reading simulation ────────────────────────────────

/**
 * Simulate a human reading/browsing a page of results.
 * Combines scrolling, hovering agent cards, and idle movements.
 */
export async function simulatePageReading(page: Page): Promise<void> {
  const cardSelector = 'a[href*="/profile/"]';

  // Initial "looking at the page" pause
  await microDelay(500, 1500);

  // Scroll down a bit
  await scrollPage(page, { distance: randomInt(300, 600) });

  // Hover some agent cards
  await hoverRandomCards(page, cardSelector, randomInt(2, 4));

  // Small idle movement
  await idleMovement(page);

  // Scroll further
  await scrollPage(page, { distance: randomInt(400, 800) });

  // Hover more cards
  await hoverRandomCards(page, cardSelector, randomInt(1, 3));

  // Another idle movement
  await idleMovement(page);

  // Scroll to bottom so pagination is visible
  await scrollPage(page);
}
