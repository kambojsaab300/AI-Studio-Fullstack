#!/usr/bin/env bash
# ============================================================
# AI Studio: Live Public Tunnel Manager (Cloudflare & Localtunnel)
# ============================================================
set -euo pipefail

API_PORT=5005
PORTAL_PORT=5174

echo "============================================================"
echo "⚡ Starting AI Studio Live Public Tunnels..."
echo "============================================================"

# Ensure API is running
if ! lsof -i :$API_PORT >/dev/null 2>&1; then
    echo "⚠️ .NET API not running on $API_PORT, starting..."
    (cd "$(dirname "$0")/../AIStudio.Api" && dotnet bin/Debug/net8.0/AIStudio.Api.dll --urls http://0.0.0.0:$API_PORT >/dev/null 2>&1 &)
    sleep 2
fi

# Ensure Vite is running
if ! lsof -i :$PORTAL_PORT >/dev/null 2>&1; then
    echo "⚠️ Vite Portal not running on $PORTAL_PORT, starting..."
    (cd "$(dirname "$0")/.." && npm run dev >/dev/null 2>&1 &)
    sleep 2
fi

# Clean up existing tunnel processes
pkill -f "localtunnel.*--port $API_PORT" 2>/dev/null || true
pkill -f "localtunnel.*--port $PORTAL_PORT" 2>/dev/null || true
pkill -f "cloudflared.*tunnel.*$API_PORT" 2>/dev/null || true
pkill -f "cloudflared.*tunnel.*$PORTAL_PORT" 2>/dev/null || true
sleep 1

# Start Cloudflare Tunnels (Ultra fast, zero reminder interstitial)
echo "☁️ Starting Cloudflare Tunnel for API ($API_PORT)..."
cloudflared tunnel --url http://127.0.0.1:$API_PORT > /tmp/cf_api.log 2>&1 &
CF_API_PID=$!

echo "☁️ Starting Cloudflare Tunnel for Portal ($PORTAL_PORT)..."
cloudflared tunnel --url http://127.0.0.1:$PORTAL_PORT > /tmp/cf_portal.log 2>&1 &
CF_PORTAL_PID=$!

# Start Localtunnels (with --local-host 127.0.0.1 to prevent Mac 502 Bad Gateway)
echo "🌐 Starting Localtunnel for API ($API_PORT)..."
npx --yes localtunnel --port $API_PORT --local-host 127.0.0.1 --subdomain aistudio-api > /tmp/lt_api.log 2>&1 &
LT_API_PID=$!

echo "🌐 Starting Localtunnel for Portal ($PORTAL_PORT)..."
npx --yes localtunnel --port $PORTAL_PORT --local-host 127.0.0.1 --subdomain aistudio-portal > /tmp/lt_portal.log 2>&1 &
LT_PORTAL_PID=$!

# Wait for tunnel initialization
sleep 6

CF_API_URL=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' /tmp/cf_api.log | tail -n 1 || echo "")
CF_PORTAL_URL=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' /tmp/cf_portal.log | tail -n 1 || echo "")

LT_API_URL=$(grep -o 'https://[^ ]*' /tmp/lt_api.log | tail -n 1 || echo "https://aistudio-api.loca.lt")
LT_PORTAL_URL=$(grep -o 'https://[^ ]*' /tmp/lt_portal.log | tail -n 1 || echo "https://aistudio-portal.loca.lt")

echo ""
echo "============================================================"
echo "🚀 1. CLOUDFLARE LIVE TUNNELS (Recommended - Fast & No Interstitial)"
echo "============================================================"
if [ -n "$CF_PORTAL_URL" ]; then
    echo "💻 Portal Hub      : $CF_PORTAL_URL"
    echo "👤 Customer App    : $CF_PORTAL_URL/customer.html"
    echo "🛠️ Admin Portal    : $CF_PORTAL_URL/admin.html"
    echo "⚙️ Worker Portal   : $CF_PORTAL_URL/worker.html"
    echo "📡 Backend API URL : $CF_API_URL"
else
    echo "⚠️ Cloudflare tunnel initializing, check /tmp/cf_portal.log"
fi

echo ""
echo "============================================================"
echo "🌐 2. LOCALTUNNELS (Fixed Subdomains)"
echo "============================================================"
echo "💻 Portal Hub      : $LT_PORTAL_URL"
echo "👤 Customer App    : $LT_PORTAL_URL/customer.html"
echo "🛠️ Admin Portal    : $LT_PORTAL_URL/admin.html"
echo "⚙️ Worker Portal   : $LT_PORTAL_URL/worker.html"
echo "📡 Backend API URL : $LT_API_URL"
echo ""
echo "Note: Localtunnel header 'Bypass-Tunnel-Reminder: true' is already built into apiClient.js"
echo "============================================================"
