#!/bin/sh
# deploy.sh - Deploy luci-app-eventcenter to router
# Preserves existing UCI config (token, chatid, etc.)
# Usage: ./deploy.sh [router_ip] [password]

ROUTER="${1:-192.168.100.1}"
PASS="${2:-password}"
BASE="$(dirname "$0")"

echo "=== Deploying to ${ROUTER} ==="

# Helper: SSH with password
ssh_cmd() {
    sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "root@${ROUTER}" "$@" 2>/dev/null
}

# Helper: SCP with password
scp_to() {
    sshpass -p "$PASS" scp -o StrictHostKeyChecking=no "$1" "root@${ROUTER}:$2" 2>/dev/null
}

# 1. Backup existing config
echo "→ Backing up config..."
ssh_cmd "cp /etc/config/eventcenter /tmp/eventcenter.bak 2>/dev/null"

# 2. Deploy files (except config)
echo "→ Deploying files..."
scp_to "${BASE}/htdocs/luci-static/resources/view/eventcenter/overview.js" "/www/luci-static/resources/view/eventcenter/overview.js"
scp_to "${BASE}/htdocs/luci-static/resources/view/eventcenter/health.js" "/www/luci-static/resources/view/eventcenter/health.js"
scp_to "${BASE}/htdocs/luci-static/resources/view/eventcenter/settings.js" "/www/luci-static/resources/view/eventcenter/settings.js"
scp_to "${BASE}/htdocs/luci-static/resources/view/eventcenter/logs.js" "/www/luci-static/resources/view/eventcenter/logs.js"
scp_to "${BASE}/root/usr/share/eventcenter/sources/openclash.sh" "/usr/share/eventcenter/sources/openclash.sh"
scp_to "${BASE}/root/usr/share/eventcenter/sources/node-health.sh" "/usr/share/eventcenter/sources/node-health.sh"
scp_to "${BASE}/root/usr/share/eventcenter/utils.sh" "/usr/share/eventcenter/utils.sh"
scp_to "${BASE}/root/usr/share/eventcenter/auth_header.sh" "/usr/share/eventcenter/auth_header.sh"
scp_to "${BASE}/root/usr/share/eventcenter/watcher.sh" "/usr/share/eventcenter/watcher.sh"
scp_to "${BASE}/root/usr/share/eventcenter/eventcenter" "/usr/bin/eventcenter"
scp_to "${BASE}/root/etc/init.d/eventcenter" "/etc/init.d/eventcenter"
scp_to "${BASE}/root/usr/share/luci/menu.d/luci-app-eventcenter.json" "/usr/share/luci/menu.d/luci-app-eventcenter.json"

# 3. Deploy config ONLY if it doesn't exist
echo "→ Checking config..."
ssh_cmd "[ -f /etc/config/eventcenter ] || cp /tmp/eventcenter.bak /etc/config/eventcenter 2>/dev/null"
ssh_cmd "[ -f /etc/config/eventcenter ] || scp_to '${BASE}/root/etc/config/eventcenter' '/etc/config/eventcenter'"

# 4. Set permissions
echo "→ Setting permissions..."
ssh_cmd "chmod 755 /usr/share/eventcenter/sources/*.sh /usr/share/eventcenter/auth_header.sh /usr/share/eventcenter/watcher.sh /usr/bin/eventcenter /etc/init.d/eventcenter"
ssh_cmd "chmod 644 /www/luci-static/resources/view/eventcenter/*.js /usr/share/luci/menu.d/luci-app-eventcenter.json"
ssh_cmd "mkdir -p /etc/eventcenter"

# 5. Restart service
echo "→ Restarting service..."
ssh_cmd "/etc/init.d/eventcenter restart"

# 6. Verify
echo "→ Verifying..."
ssh_cmd "eventcenter status" && echo "✓ Service OK" || echo "✗ Service failed"

echo "=== Done ==="
