#!/bin/sh
# deploy.sh - Deploy luci-app-eventcenter to router
# Preserves existing UCI config (token, chatid, etc.)
# Usage: ./deploy.sh [router_ip] [password]

ROUTER="${1:-192.168.100.1}"
PASS="${2:-password}"
BASE="$(dirname "$0")"

echo "=== Deploying v1.3.0 to ${ROUTER} ==="

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

# 2. Deploy frontend files
echo "→ Deploying frontend..."
scp_to "${BASE}/htdocs/luci-static/resources/view/eventcenter/overview.js" "/www/luci-static/resources/view/eventcenter/overview.js"
scp_to "${BASE}/htdocs/luci-static/resources/view/eventcenter/health.js" "/www/luci-static/resources/view/eventcenter/health.js"
scp_to "${BASE}/htdocs/luci-static/resources/view/eventcenter/settings.js" "/www/luci-static/resources/view/eventcenter/settings.js"
scp_to "${BASE}/htdocs/luci-static/resources/view/eventcenter/logs.js" "/www/luci-static/resources/view/eventcenter/logs.js"

# 3. Deploy backend scripts
echo "→ Deploying backend..."
scp_to "${BASE}/root/usr/share/eventcenter/sources/openclash.sh" "/usr/share/eventcenter/sources/openclash.sh"
scp_to "${BASE}/root/usr/share/eventcenter/sources/node-health.sh" "/usr/share/eventcenter/sources/node-health.sh"
scp_to "${BASE}/root/usr/share/eventcenter/utils.sh" "/usr/share/eventcenter/utils.sh"
scp_to "${BASE}/root/usr/share/eventcenter/auth_header.sh" "/usr/share/eventcenter/auth_header.sh"
scp_to "${BASE}/root/usr/share/eventcenter/watcher.sh" "/usr/share/eventcenter/watcher.sh"
scp_to "${BASE}/root/usr/share/eventcenter/engine.sh" "/usr/share/eventcenter/engine.sh"
scp_to "${BASE}/root/usr/bin/eventcenter" "/usr/bin/eventcenter"

# 4. Deploy notifiers (new in v1.3.0)
echo "→ Deploying notifiers..."
scp_to "${BASE}/root/usr/bin/notifier_telegram.sh" "/usr/bin/notifier_telegram.sh"
scp_to "${BASE}/root/usr/bin/notifier_wechat.sh" "/usr/bin/notifier_wechat.sh"
scp_to "${BASE}/root/usr/bin/notifier_bark.sh" "/usr/bin/notifier_bark.sh"
scp_to "${BASE}/root/usr/bin/notifier_pushplus.sh" "/usr/bin/notifier_pushplus.sh"

# 5. Deploy init.d and menu
echo "→ Deploying service files..."
scp_to "${BASE}/root/etc/init.d/eventcenter" "/etc/init.d/eventcenter"
scp_to "${BASE}/root/usr/share/luci/menu.d/luci-app-eventcenter.json" "/usr/share/luci/menu.d/luci-app-eventcenter.json"

# 6. Run uci-defaults to add new sections (won't overwrite existing)
echo "→ Running uci-defaults for new config sections..."
scp_to "${BASE}/root/etc/uci-defaults/luci-app-eventcenter" "/tmp/luci-app-eventcenter-uci-defaults"
ssh_cmd "chmod 755 /tmp/luci-app-eventcenter-uci-defaults && /tmp/luci-app-eventcenter-uci-defaults && rm -f /tmp/luci-app-eventcenter-uci-defaults"

# 7. Set permissions
echo "→ Setting permissions..."
ssh_cmd "chmod 755 /usr/share/eventcenter/sources/*.sh /usr/share/eventcenter/auth_header.sh /usr/share/eventcenter/watcher.sh /usr/share/eventcenter/engine.sh /usr/bin/eventcenter /etc/init.d/eventcenter"
ssh_cmd "chmod 755 /usr/bin/notifier_telegram.sh /usr/bin/notifier_wechat.sh /usr/bin/notifier_bark.sh /usr/bin/notifier_pushplus.sh"
ssh_cmd "chmod 644 /www/luci-static/resources/view/eventcenter/*.js /usr/share/luci/menu.d/luci-app-eventcenter.json"
ssh_cmd "mkdir -p /etc/eventcenter"

# 8. Restart service
echo "→ Restarting service..."
ssh_cmd "/etc/init.d/eventcenter restart"

# 9. Clear LuCI cache
echo "→ Clearing LuCI cache..."
ssh_cmd "rm -rf /tmp/luci-*"

# 10. Verify
echo "→ Verifying..."
ssh_cmd "eventcenter status" && echo "✓ Service OK" || echo "✗ Service failed"

echo "=== Done (v1.3.0) ==="
