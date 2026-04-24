#!/bin/bash
# Smoke test for the full Copilot Chat Bingo stack
set -e

API_BASE="http://localhost:7071/api"
ADMIN_KEY="smoke-test-admin-key"

echo "============================================="
echo "  Copilot Chat Bingo — Smoke Test"
echo "============================================="
echo ""

pass=0
fail=0

check() {
  local desc="$1"
  local result="$2"
  local expected="$3"
  if echo "$result" | grep -q "$expected"; then
    echo "  ✅ $desc"
    pass=$((pass + 1))
  else
    echo "  ❌ $desc"
    echo "     Expected: $expected"
    echo "     Got: $result"
    fail=$((fail + 1))
  fi
}

echo "🔍 1. Public Config Endpoints"
echo "---------------------------------------------"

# Campaign config
result=$(curl -sf "$API_BASE/campaigns/active" 2>/dev/null || echo "FAIL")
check "GET /campaigns/active returns active campaign" "$result" '"campaignId":"APR26"'

# Org domains
result=$(curl -sf "$API_BASE/organizations/domains" 2>/dev/null || echo "FAIL")
check "GET /organizations/domains returns domain map" "$result" '"nus.edu.sg":"NUS"'

# Leaderboard (empty)
result=$(curl -sf "$API_BASE/leaderboard" 2>/dev/null || echo "FAIL")
check "GET /leaderboard returns empty leaderboard" "$result" '"leaderboard"'

echo ""
echo "🎮 2. Player Flow — Email Gate + Session"
echo "---------------------------------------------"

# Player state (new player)
result=$(curl -sf "$API_BASE/player/state?email=alice@nus.edu.sg" 2>/dev/null || echo "FAIL")
check "GET /player/state for new player returns null" "$result" '"player":null'

# Create session
result=$(curl -sf -X POST "$API_BASE/sessions" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"smoke-test-001","playerName":"Alice","packId":42,"email":"alice@nus.edu.sg"}' \
  2>/dev/null || echo "FAIL")
check "POST /sessions creates session with email" "$result" '"ok":true'
GAME_SESSION_ID=$(echo "$result" | grep -o '"gameSessionId":[0-9]*' | grep -o '[0-9]*')
echo "     (gameSessionId: $GAME_SESSION_ID)"

# Player state (existing player)
result=$(curl -sf "$API_BASE/player/state?email=alice@nus.edu.sg" 2>/dev/null || echo "FAIL")
check "GET /player/state returns player after session" "$result" '"playerName":"Alice"'

echo ""
echo "🎯 3. Game Events — Tile Clear + Board State"
echo "---------------------------------------------"

# Record tile event
if [ -n "$GAME_SESSION_ID" ]; then
  result=$(curl -sf -X POST "$API_BASE/events" \
    -H "Content-Type: application/json" \
    -d "{\"gameSessionId\":$GAME_SESSION_ID,\"tileIndex\":0,\"eventType\":\"cleared\"}" \
    2>/dev/null || echo "FAIL")
  check "POST /events records tile clear" "$result" '"ok":true'

  # Update session with board state
  result=$(curl -sf -X PATCH "$API_BASE/sessions/$GAME_SESSION_ID" \
    -H "Content-Type: application/json" \
    -d '{"tilesCleared":1,"linesWon":0,"keywordsEarned":0,"boardState":{"cleared":[true,false,false,false,false,false,false,false,false],"wonLines":[],"keywords":[]}}' \
    2>/dev/null || echo "FAIL")
  check "PATCH /sessions/:id saves board state" "$result" '"ok":true'

  # Verify board state is retrievable
  result=$(curl -sf "$API_BASE/player/state?email=alice@nus.edu.sg" 2>/dev/null || echo "FAIL")
  check "Board state persists and is retrievable" "$result" '"cleared"'
fi

echo ""
echo "📬 4. Keyword Submission"
echo "---------------------------------------------"

result=$(curl -sf -X POST "$API_BASE/submissions" \
  -H "Content-Type: application/json" \
  -d '{"org":"NUS","name":"Alice","email":"alice@nus.edu.sg","keyword":"CO-APR26-042-R1-ABCD1234"}' \
  2>/dev/null || echo "FAIL")
check "POST /submissions accepts keyword" "$result" '"ok":true'

# Leaderboard should now have NUS
result=$(curl -sf "$API_BASE/leaderboard" 2>/dev/null || echo "FAIL")
check "Leaderboard shows NUS after submission" "$result" '"org":"NUS"'

# Duplicate submission
result=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_BASE/submissions" \
  -H "Content-Type: application/json" \
  -d '{"org":"NUS","name":"Alice","email":"alice@nus.edu.sg","keyword":"CO-APR26-042-R1-ABCD1234"}' \
  2>/dev/null || echo "FAIL")
check "Duplicate submission returns 409" "$result" "409"

echo ""
echo "🔐 5. Admin Auth — OTP Flow"
echo "---------------------------------------------"

# Request OTP (admin email)
result=$(curl -sf -X POST "$API_BASE/admin/request-otp" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com"}' \
  2>/dev/null || echo "FAIL")
check "POST /admin/request-otp accepts admin email" "$result" '"ok":true'

# Request OTP (non-admin — same response, no enumeration)
result=$(curl -sf -X POST "$API_BASE/admin/request-otp" \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@test.com"}' \
  2>/dev/null || echo "FAIL")
check "POST /admin/request-otp same response for non-admin" "$result" '"ok":true'

# Verify OTP with wrong code
result=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_BASE/admin/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","code":"000000"}' \
  2>/dev/null || echo "FAIL")
check "POST /admin/verify-otp rejects wrong code" "$result" "401"

echo ""
echo "🔑 6. Admin Endpoints (x-admin-key auth)"
echo "---------------------------------------------"

# Dashboard
result=$(curl -sf "$API_BASE/admin/dashboard" \
  -H "X-Admin-Key: $ADMIN_KEY" 2>/dev/null || echo "FAIL")
check "GET /admin/dashboard returns stats" "$result" '"totalPlayers"'

# CSV export
result=$(curl -sf -o /dev/null -w "%{http_code}" "$API_BASE/admin/export" \
  -H "X-Admin-Key: $ADMIN_KEY" 2>/dev/null || echo "FAIL")
check "GET /admin/export returns CSV" "$result" "200"

# List organizations
result=$(curl -sf "$API_BASE/admin/organizations" \
  -H "X-Admin-Key: $ADMIN_KEY" 2>/dev/null || echo "FAIL")
check "GET /admin/organizations lists orgs" "$result" '"NUS"'

# Create organization
result=$(curl -sf -X POST "$API_BASE/admin/organizations" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -d '{"name":"TestOrg"}' \
  2>/dev/null || echo "FAIL")
check "POST /admin/organizations creates org" "$result" '"ok":true'
NEW_ORG_ID=$(echo "$result" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')

# Add domain to org
if [ -n "$NEW_ORG_ID" ]; then
  result=$(curl -sf -X POST "$API_BASE/admin/organizations/$NEW_ORG_ID/domains" \
    -H "Content-Type: application/json" \
    -H "X-Admin-Key: $ADMIN_KEY" \
    -d '{"domain":"testorg.edu.sg"}' \
    2>/dev/null || echo "FAIL")
  check "POST /admin/organizations/:id/domains adds domain" "$result" '"ok":true'

  # Delete org
  result=$(curl -sf -X DELETE "$API_BASE/admin/organizations/$NEW_ORG_ID" \
    -H "X-Admin-Key: $ADMIN_KEY" 2>/dev/null || echo "FAIL")
  check "DELETE /admin/organizations/:id removes org" "$result" '"ok":true'
fi

# List campaigns
result=$(curl -sf "$API_BASE/admin/campaigns" \
  -H "X-Admin-Key: $ADMIN_KEY" 2>/dev/null || echo "FAIL")
check "GET /admin/campaigns lists campaigns" "$result" '"APR26"'

# Search players
result=$(curl -sf "$API_BASE/admin/players?q=alice" \
  -H "X-Admin-Key: $ADMIN_KEY" 2>/dev/null || echo "FAIL")
check "GET /admin/players?q=alice finds player" "$result" '"alice@nus.edu.sg"'

# Player detail
PLAYER_ID=$(echo "$result" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
if [ -n "$PLAYER_ID" ]; then
  result=$(curl -sf "$API_BASE/admin/players/$PLAYER_ID" \
    -H "X-Admin-Key: $ADMIN_KEY" 2>/dev/null || echo "FAIL")
  check "GET /admin/players/:id returns detail" "$result" '"sessions"'
fi

# Unauthorized access
result=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/admin/dashboard" 2>/dev/null || echo "FAIL")
check "Admin dashboard rejects unauthenticated" "$result" "401"

echo ""
echo "🌐 7. Frontend"
echo "---------------------------------------------"

result=$(curl -sf -o /dev/null -w "%{http_code}" "http://localhost:8080/" 2>/dev/null || echo "FAIL")
check "Frontend serves index.html" "$result" "200"

result=$(curl -sf "http://localhost:8080/" 2>/dev/null || echo "FAIL")
check "Frontend contains Vue app mount" "$result" "app"

echo ""
echo "============================================="
echo "  Results: $pass passed, $fail failed"
echo "============================================="

if [ $fail -gt 0 ]; then
  exit 1
else
  echo "  🎉 All smoke tests passed!"
fi
