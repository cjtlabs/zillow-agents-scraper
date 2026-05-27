export async function randomDelay(baseMs: number): Promise<void> {
  const jitter = 0.3;
  const min = baseMs * (1 - jitter);
  const max = baseMs * (1 + jitter);
  const actual = Math.floor(min + Math.random() * (max - min));
  console.log(`[delay] Waiting ${actual}ms`);
  return new Promise((resolve) => setTimeout(resolve, actual));
}

/** Silent delay for micro-pauses within mouse movement (no console log). */
export async function microDelay(minMs: number, maxMs: number): Promise<void> {
  const actual = Math.floor(minMs + Math.random() * (maxMs - minMs));
  return new Promise((resolve) => setTimeout(resolve, actual));
}
