#!/bin/sh
# Event Center - Device Monitor Event Source
# Monitors device online/offline status via DHCP leases and ARP table
# Sends notifications when tracked devices go online/offline

# Source utilities
. /usr/share/eventcenter/utils.sh

STATE_FILE="/tmp/eventcenter_device_state"

# --- Get connected devices ---

get_dhcp_leases() {
    # Parse DHCP lease file (dnsmasq format)
    # MAC IP hostname expiry client-id
    local _lease_file="/tmp/dhcp.leases"
    [ -f "$_lease_file" ] || return

    awk '{
        mac = toupper($1)
        ip = $2
        name = ($3 == "*" ? "" : $3)
        printf "%s\t%s\t%s\n", mac, ip, name
    }' "$_lease_file"
}

get_arp_table() {
    # Parse ARP table for active connections
    awk 'NR > 1 && $3 ~ /^[0-9a-fA-F:]+$/ {
        mac = toupper($3)
        ip = $1
        printf "%s\t%s\n", mac, ip
    }' /proc/net/arp 2>/dev/null
}

# --- Device name resolution ---

resolve_device_name() {
    local _mac="$1"
    local _ip="$2"
    local _hostname="$3"

    # If hostname is available from DHCP, use it
    if [ -n "$_hostname" ] && [ "$_hostname" != "*" ]; then
        echo "$_hostname"
        return
    fi

    # Try reverse DNS
    local _dns_name
    _dns_name=$(nslookup "$_ip" 2>/dev/null | awk '/name =/ {gsub(/\.$/, "", $4); print $4}')
    if [ -n "$_dns_name" ]; then
        echo "$_dns_name"
        return
    fi

    # Fallback to MAC address
    echo "$_mac"
}

# --- Main check ---

check() {
    local _enable
    _enable=$(ec_uci_get "device_monitor.enable" "0")
    [ "$_enable" != "1" ] && return 0

    # Read tracked MACs from config
    local _tracked_macs
    _tracked_macs=$(ec_uci_get "device_monitor.mac" "")
    if [ -z "$_tracked_macs" ]; then
        logger -t eventcenter "device-monitor: no MACs configured for tracking"
        return 0
    fi

    # Load previous state
    local _prev_state=""
    [ -f "$STATE_FILE" ] && _prev_state=$(cat "$STATE_FILE")

    # Get current connected devices
    local _current_devices="/tmp/ec_devices_current_$$"
    : > "$_current_devices"

    # Merge DHCP leases and ARP table
    {
        get_dhcp_leases
        get_arp_table
    } | sort -u > "$_current_devices"

    # Build current online MAC set
    local _online_macs="/tmp/ec_online_macs_$$"
    awk -F'\t' '{print $1}' "$_current_devices" | sort -u > "$_online_macs"

    # Process tracked MACs
    local _tmp_events="/tmp/ec_device_events_$$"
    : > "$_tmp_events"

    echo "$_tracked_macs" | tr ',' '\n' | while read -r _mac; do
        _mac=$(echo "$_mac" | tr 'a-f' 'A-F' | xargs)
        [ -z "$_mac" ] && continue

        # Get device info
        local _device_info
        _device_info=$(fgrep -F "$_mac" "$_current_devices" | head -1)
        local _ip _hostname
        _ip=$(echo "$_device_info" | cut -f2)
        _hostname=$(echo "$_device_info" | cut -f3)

        # Resolve name
        local _name
        _name=$(resolve_device_name "$_mac" "$_ip" "$_hostname")

        # Check if online
        local _is_online=0
        if fgrep -qF "$_mac" "$_online_macs"; then
            _is_online=1
        fi

        # Check previous state
        local _was_online=0
        if echo "$_prev_state" | grep -q "^${_mac}="; then
            local _prev_status
            _prev_status=$(echo "$_prev_state" | grep "^${_mac}=" | cut -d'=' -f2)
            [ "$_prev_status" = "1" ] && _was_online=1
        fi

        # Detect state change
        if [ "$_is_online" = "1" ] && [ "$_was_online" = "0" ]; then
            # Device came online
            printf '%s\t%s\t%s\t%s\n' "online" "$_mac" "$_name" "${_ip:-N/A}" >> "$_tmp_events"
        elif [ "$_is_online" = "0" ] && [ "$_was_online" = "1" ]; then
            # Device went offline
            printf '%s\t%s\t%s\t%s\n' "offline" "$_mac" "$_name" "${_ip:-N/A}" >> "$_tmp_events"
        fi
    done

    # Update state file
    local _new_state="/tmp/ec_device_state_new_$$"
    : > "$_new_state"
    echo "$_tracked_macs" | tr ',' '\n' | while read -r _mac; do
        _mac=$(echo "$_mac" | tr 'a-f' 'A-F' | xargs)
        [ -z "$_mac" ] && continue
        local _status=0
        if fgrep -qF "$_mac" "$_online_macs"; then
            _status=1
        fi
        echo "${_mac}=${_status}"
    done > "$_new_state"
    mv "$_new_state" "$STATE_FILE"

    # Send notifications
    if [ -s "$_tmp_events" ]; then
        # Build notification message
        local _msg=""
        local _online_count=0
        local _offline_count=0

        while IFS=$'\t' read -r _action _mac _name _ip; do
            [ -z "$_action" ] && continue

            if [ "$_action" = "online" ]; then
                _online_count=$(( _online_count + 1 ))
                _msg=$(printf "%s🟢 *%s* 上线\n   MAC: `%s`\n   IP: `%s`\n\n" "$_msg" "$_name" "$_mac" "$_ip")
            else
                _offline_count=$(( _offline_count + 1 ))
                _msg=$(printf "%s🔴 *%s* 离线\n   MAC: `%s`\n\n" "$_msg" "$_name" "$_mac")
            fi
        done < "$_tmp_events"

        local _title=""
        if [ "$_online_count" -gt 0 ] && [ "$_offline_count" -gt 0 ]; then
            _title=$(printf "设备变动: %d台上线, %d台离线" "$_online_count" "$_offline_count")
        elif [ "$_online_count" -gt 0 ]; then
            _title=$(printf "设备上线: %d台" "$_online_count")
        else
            _title=$(printf "设备离线: %d台" "$_offline_count")
        fi

        local _header=$(printf "📱 *设备状态变动*\n━━━━━━━━━━━━━━━━\n\n")
        _msg="${_header}${_msg}"

        eventcenter emit system "device_change" "info" \
            "$_title" \
            "$_msg"
    fi

    # Cleanup
    rm -f "$_current_devices" "$_online_macs" "$_tmp_events"
}

# --- Status (for overview page) ---

status() {
    local _tracked_macs
    _tracked_macs=$(ec_uci_get "device_monitor.mac" "")

    echo "=== Device Monitor Status ==="
    echo "Tracked MACs: $(echo "$_tracked_macs" | tr ',' '\n' | wc -l)"
    echo ""

    if [ -n "$_tracked_macs" ]; then
        echo "--- Tracked Devices ---"
        echo "$_tracked_macs" | tr ',' '\n' | while read -r _mac; do
            _mac=$(echo "$_mac" | tr 'a-f' 'A-F' | xargs)
            [ -z "$_mac" ] && continue

            local _status="unknown"
            if [ -f "$STATE_FILE" ] && grep -q "^${_mac}=1$" "$STATE_FILE"; then
                _status="online"
            elif [ -f "$STATE_FILE" ] && grep -q "^${_mac}=0$" "$STATE_FILE"; then
                _status="offline"
            fi

            printf "  %-20s %s\n" "$_mac" "$_status"
        done
    fi
}

# --- Main entry point ---
# --- List tracked devices ---
device_list() {
    local _state_file="/tmp/eventcenter_device_state"
    if [ -f "$_state_file" ] && [ -s "$_state_file" ]; then
        cat "$_state_file"
    else
        # Fallback: show all devices from DHCP lease file
        # dhcp.leases format: timestamp MAC IP hostname client-id
        awk '{mac=toupper($2); ip=$3; printf "%s\t%s\tup\n", mac, ip}' /tmp/dhcp.leases 2>/dev/null | sort -u
    fi
}

case "$1" in
    list)
        device_list
        ;;
    status)
        status
        ;;
    check)
        check
        ;;
    *)
        check
        ;;
esac
