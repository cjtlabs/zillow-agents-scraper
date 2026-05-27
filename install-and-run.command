#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# Zillow Scraper — One-click installer & runner for macOS
#
# Tell your coworkers to open Terminal and paste this one-liner:
#
#   curl -fsSL https://raw.githubusercontent.com/cjtlabs/zillow-agents-scraper/main/install-and-run.command | bash
#
# ─────────────────────────────────────────────────────────────────────

# ⚠️  SET YOUR REPO URL HERE
REPO_URL="https://github.com/cjtlabs/zillow-agents-scraper.git"

INSTALL_DIR="$HOME/zillow-agents-scraper"

set -e

echo ""
echo "======================================"
echo "  Zillow Agent Scraper — Setup & Run"
echo "======================================"
echo ""

# ── Step 1: Homebrew ────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  echo "[setup] Installing Homebrew (macOS package manager)..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  # Add Homebrew to PATH for Apple Silicon Macs
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
else
  echo "[setup] Homebrew ✓"
fi

# ── Step 2: Node.js ────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "[setup] Installing Node.js..."
  brew install node
else
  echo "[setup] Node.js ✓ ($(node -v))"
fi

# ── Step 3: pnpm ───────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  echo "[setup] Installing pnpm..."
  npm install -g pnpm
else
  echo "[setup] pnpm ✓ ($(pnpm -v))"
fi

# ── Step 4: Clone or update repo ──────────────────────────────────
if [[ -d "$INSTALL_DIR/.git" ]]; then
  echo "[setup] Updating repository..."
  cd "$INSTALL_DIR"
  git pull --ff-only
else
  echo "[setup] Cloning repository..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ── Step 5: Install dependencies ──────────────────────────────────
echo "[setup] Installing project dependencies..."
pnpm install

# ── Step 6: Install Playwright browsers ───────────────────────────
echo "[setup] Installing Playwright browsers (this may take a minute)..."
pnpm exec playwright install chromium

# ── Step 7: Build ─────────────────────────────────────────────────
echo "[setup] Building project..."
pnpm build

echo ""
echo "======================================"
echo "  Setup complete!"
echo "======================================"
echo ""

# ── Step 8: Prompt for cities ─────────────────────────────────────
echo "Enter the cities you want to scrape, separated by spaces."
echo "Format: city-name-state (e.g. los-angeles-ca beverly-hills-ca)"
echo ""
echo "Common examples:"
echo "  los-angeles-ca"
echo "  beverly-hills-ca"
echo "  pasadena-ca"
echo "  burbank-ca"
echo "  santa-monica-ca"
echo ""
read -rp "Cities (or press Enter for los-angeles-ca): " CITIES_INPUT

if [[ -z "$CITIES_INPUT" ]]; then
  CITIES_INPUT="los-angeles-ca"
fi

echo ""
echo "[scraper] Running with cities: $CITIES_INPUT"
echo ""

# ── Step 9: Run ───────────────────────────────────────────────────
pnpm start $CITIES_INPUT

echo ""
echo "======================================"
echo "  Done! Results saved to:"
echo "  $INSTALL_DIR/output/agents.json"
echo "======================================"
echo ""
read -rp "Press Enter to close this window..."
