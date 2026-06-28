#!/bin/sh
# Event Center - Device Monitor Event Source
# Monitors ALL devices via DHCP leases + ARP table
# Compares with previous snapshot, notifies on changes (online/offline)

# Source utilities
. /usr/share/eventcenter/utils.sh

STATE_FILE="/tmp/eventcenter_device_state"

# --- Get connected devices ---

get_all_devices() {
    # Merge DHCP leases + ARP table, deduplicate by MAC
    # Output: MAC\tIP\tName
    {
        # DHCP leases: MAC IP hostname expiry
        [ -f /tmp/dhcp.leases ] && awk '{
            mac = toupper($2)
            ip = $3
            name = ($4 == "*" ? "" : $4)
            printf "%s\t%s\t%s\n", mac, ip, name
        }' /tmp/dhcp.leases

        # ARP table: IP HWType Flags HWAddr Mask Device
        awk 'NR > 1 && $3 ~ /^[0-9a-fA-F:]+$/ {
            mac = toupper($3)
            ip = $1
            printf "%s\t%s\t\n", mac, ip
        }' /proc/net/arp 2>/dev/null
    } | sort -t'	' -k1,1 -u
}

# --- Resolve device name ---

resolve_name() {
    local _mac="$1" _ip="$2" _dhcp_name="$3"

    # Prefer DHCP hostname
    if [ -n "$_dhcp_name" ] && [ "$_dhcp_name" != "*" ]; then
        echo "$_dhcp_name"
        return
    fi

    # Try reverse DNS
    if [ -n "$_ip" ] && [ "$_ip" != "N/A" ]; then
        local _dns
        _dns=$(nslookup "$_ip" 2>/dev/null | awk '/name =/ {gsub(/\.$/, "", $4); print $4}')
        if [ -n "$_dns" ]; then
            echo "$_dns"
            return
        fi
    fi

    # Fallback to MAC
    echo "$_mac"
}

# --- Main check ---

check() {
    local _enable
    _enable=$(ec_uci_get "device_monitor.enable" "0")
    [ "$_enable" != "1" ] && return 0

    # Get current devices
    local _current="/tmp/ec_dev_current_$$"
    get_all_devices > "$_current"

    # Build current MAC set (just MACs)
    local _current_macs="/tmp/ec_dev_macs_$$"
    awk -F'\t' '{print $1}' "$_current" | sort -u > "$_current_macs"

    # Load previous state (MAC\tIP\tName format)
    local _prev="/tmp/ec_dev_prev_$$"
    : > "$_prev"
    [ -f "$STATE_FILE" ] && cat "$STATE_FILE" > "$_prev"

    # Build previous MAC set
    local _prev_macs="/tmp/ec_dev_prev_macs_$$"
    awk -F'\t' '{print $1}' "$_prev" | sort -u > "$_prev_macs"

    # First run: save baseline, don't notify
    if [ ! -f "$STATE_FILE" ]; then
        cp "$_current" "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
        local _count
        _count=$(wc -l < "$_current")
        logger -t eventcenter "device-monitor: baseline saved ($_count devices)"
        rm -f "$_current" "$_current_macs" "$_prev" "$_prev_macs"
        return 0
    fi

    # Find new devices (in current but not in prev)
    local _new_macs="/tmp/ec_dev_new_$$"
    awk -F'\t' 'NR==FNR{a[$1];next} !($1 in a)' "$_prev_macs" "$_current_macs" > "$_new_macs"

    # Find gone devices (in prev but not in current)
    local _gone_macs="/tmp/ec_dev_gone_$$"
    awk -F'\t' 'NR==FNR{a[$1];next} !($1 in a)' "$_current_macs" "$_prev_macs" > "$_gone_macs"

    # Build notification
    local _msg=""
    local _online_count=0
    local _offline_count=0

    # New devices
    while IFS= read -r _mac; do
        [ -z "$_mac" ] && continue
        local _info _ip _name
        _info=$(grep "^${_mac}	" "$_current" | head -1)
        _ip=$(echo "$_info" | cut -f2)
        _name=$(echo "$_info" | cut -f3)
        _name=$(resolve_name "$_mac" "$_ip" "$_name")
        [ -z "$_ip" ] && _ip="N/A"

        _online_count=$(( _online_count + 1 ))
        _msg=$(printf "%s🟢 *%s* 上线\n   MAC: \`%s\` | IP: \`%s\`\n\n" "$_msg" "$_name" "$_mac" "$_ip")
    done < "$_new_macs"

    # Gone devices
    while IFS= read -r _mac; do
        [ -z "$_mac" ] && continue
        local _info _ip _name
        _info=$(grep "^${_mac}	" "$_prev" | head -1)
        _ip=$(echo "$_info" | cut -f2)
        _name=$(echo "$_info" | cut -f3)
        _name=$(resolve_name "$_mac" "$_ip" "$_name")
        [ -z "$_ip" ] && _ip="N/A"

        _offline_count=$(( _offline_count + 1 ))
        _msg=$(printf "%s🔴 *%s* 离线\n   MAC: \`%s\` | IP: \`%s\`\n\n" "$_msg" "$_name" "$_mac" "$_ip")
    done < "$_gone_macs"

    # Send notification if there are changes
    if [ "$_online_count" -gt 0 ] || [ "$_offline_count" -gt 0 ]; then
        local _title="设备状态变动"

        local _total _ts
        _total=$(wc -l < "$_current_macs")
        _ts=$(date '+%Y-%m-%d %H:%M:%S')

        local _header=$(printf "📱 *设备状态变动*\n━━━━━━━━━━━━━━━━\n📅 %s\n当前在线: %d台\n\n" "$_ts" "$_total")
        _msg="${_header}${_msg}"

        eventcenter emit system "device_change" "info" \
            "$_title" \
            "$_msg" "ec:设备监控"
    fi

    # Update state file (atomic write)
    cp "$_current" "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

    # Cleanup
    rm -f "$_current" "$_current_macs" "$_prev" "$_prev_macs"
    rm -f "$_new_macs" "$_gone_macs"
}

# --- Device list (for overview page, tab-separated) ---

device_list() {
    if [ -f "$STATE_FILE" ] && [ -s "$STATE_FILE" ]; then
        cat "$STATE_FILE"
    fi
}

# --- Status (for overview page) ---

status() {
    echo "=== Device Monitor Status ==="
    if [ -f "$STATE_FILE" ] && [ -s "$STATE_FILE" ]; then
        local _count
        _count=$(wc -l < "$STATE_FILE")
        echo "Known devices: $_count"
        echo ""
        echo "--- Device List ---"
        while IFS='	' read -r _mac _ip _name; do
            [ -z "$_mac" ] && continue
            printf "  %-20s %-16s %s\n" "$_mac" "${_ip:-N/A}" "${_name:-unknown}"
        done < "$STATE_FILE"
    else
        echo "No state file yet. Will be created on first check."
    fi
}

case "$1" in
    list)   device_list ;;
    status) status ;;
    check)  check ;;
    *)      check ;;
esac
