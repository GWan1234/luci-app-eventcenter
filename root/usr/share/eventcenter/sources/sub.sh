#!/bin/sh
# Event Center - Subscription Expiry Monitor
# Checks Clash subscription expiry dates and sends reminders
# Reads subscription info from OpenClash config YAML files

. /usr/share/eventcenter/utils.sh

# extract_sub_info <yaml_file>
# Outputs: sub_name|expire_timestamp|remaining_days|traffic_used|traffic_total
extract_sub_info() {
    local _file="$1"
    local _sub_name
    _sub_name=$(basename "$_file" .yaml)
    _sub_name=$(basename "$_sub_name" .yml)

    # Try to get real subscription name from YAML content
    local _real_name
    _real_name=$(grep -i '^name:' "$_file" 2>/dev/null | head -1 | sed 's/^name:[[:space:]]*//;s/[#"].*//;s/[[:space:]]*$//')
    if [ -n "$_real_name" ]; then
        _sub_name="$_real_name"
    fi

    # Try to find subscription info in proxy-provider blocks
    local _expire _traffic_used _traffic_total
    _expire=$(awk '
        /^  [a-zA-Z0-9_-]+:/ { current=$0; gsub(/:/, "", current) }
        current && /expires:/ {
            gsub(/^[[:space:]]*expires:[[:space:]]*/, "")
            gsub(/["\047]/, "")
            print; current=""
        }
    ' "$_file" 2>/dev/null | head -1)

    # Also try the top-level subscription-info comment format
    if [ -z "$_expire" ]; then
        _expire=$(grep -i 'expire\|到期\|过期' "$_file" 2>/dev/null | head -1 | \
            sed -n 's/.*expire[_-]\{0,1}[a-z]*[[:space:]]*:[[:space:]]*["\047]*\([0-9]*\).*/\1/p')
    fi

    # Try reading from Clash API subscription info
    if [ -z "$_expire" ]; then
        local _port _url _hdr
        _port=$(get_clash_port 2>/dev/null || echo 9090)
        _url="http://127.0.0.1:${_port}/providers/proxies"
        _hdr=$(/usr/share/eventcenter/auth_header.sh)
        local _api_json
        _api_json=$(curl -s -m 5 -H "$_hdr" "$_url" 2>/dev/null)
        if [ -n "$_api_json" ]; then
            _expire=$(printf '%s' "$_api_json" | grep -o '"subscriptionInfo":{[^}]*}' | \
                grep -o '"expire":[0-9]*' | grep -o '[0-9]*' | head -1)
        fi
    fi

    # Calculate remaining days from timestamp
    local _remaining=""
    if [ -n "$_expire" ] && [ "$_expire" -gt 0 ] 2>/dev/null; then
        local _now
        _now=$(date '+%s')
        local _diff
        _diff=$(( (_expire - _now) / 86400 ))
        _remaining="$_diff"
    fi

    # Traffic info (from subscription-info comment or API)
    _traffic_used=""
    _traffic_total=""
    local _si
    _si=$(grep -i 'subscription-info\|订阅信息' "$_file" 2>/dev/null | head -1)
    if [ -n "$_si" ]; then
        _traffic_total=$(echo "$_si" | sed -n 's/.*total[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
        _traffic_used=$(echo "$_si" | sed -n 's/.*used[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')
    fi

    printf '%s|%s|%s|%s|%s\n' "$_sub_name" "${_expire:-0}" "${_remaining:-N/A}" "${_traffic_used:-}" "${_traffic_total:-}"
}

# format_traffic <bytes>
# Converts bytes to human-readable format
format_traffic() {
    local _bytes="$1"
    if [ -z "$_bytes" ] || [ "$_bytes" -eq 0 ] 2>/dev/null; then
        printf "N/A"
        return
    fi
    if [ "$_bytes" -ge 1073741824 ] 2>/dev/null; then
        awk -v b="$_bytes" 'BEGIN { printf "%.1f GB", b/1073741824 }'
    elif [ "$_bytes" -ge 1048576 ] 2>/dev/null; then
        awk -v b="$_bytes" 'BEGIN { printf "%.1f MB", b/1048576 }'
    elif [ "$_bytes" -ge 1024 ] 2>/dev/null; then
        awk -v b="$_bytes" 'BEGIN { printf "%.1f KB", b/1024 }'
    else
        printf "%s B" "$_bytes"
    fi
}

# check()
# Main entry: checks all subscriptions for expiry

get_clash_port() {
    local _ec_port
    _ec_port=$(grep -o 'external-controller:[^:]*:\([0-9]*\)' /etc/openclash/config/*.yaml 2>/dev/null | head -1 | grep -o '[0-9]*$')
    echo "${_ec_port:-9090}"
}

check() {
    local _enable
    _enable=$(ec_uci_get "sub.enable" "0")
    [ "$_enable" != "1" ] && return 0

    local _remind_days
    _remind_days=$(ec_uci_get "sub.remind_days" "7")

    # Discover config files
    local _config_files=""
    local _paths
    _paths=$(uci -q get eventcenter.@monitor[0].paths 2>/dev/null)
    if [ -n "$_paths" ]; then
        _config_files=$(echo "$_paths" | tr ',' '\n')
    else
        [ -d "/etc/openclash/config" ] && _config_files=$(find /etc/openclash/config -maxdepth 1 -name '*.yaml' -type f 2>/dev/null)
    fi

    # Filter by sub_names if configured
    local _sub_names
    _sub_names=$(ec_uci_get "sub.sub_names" "")

    local _alerts=""
    local _level="info"
    local _alert_count=0

    for _cf in $_config_files; do
        [ -z "$_cf" ] || [ ! -f "$_cf" ] && continue

        local _sub_name
        _sub_name=$(basename "$_cf" .yaml)

        # If sub_names filter is set, only check listed subscriptions
        if [ -n "$_sub_names" ]; then
            echo "$_sub_names" | tr ',' '\n' | grep -qxF "$_sub_name" || continue
        fi

        local _info
        _info=$(extract_sub_info "$_cf")
        [ -z "$_info" ] && continue

        local _name _expire_ts _remaining _used _total
        _name=$(echo "$_info" | cut -d'|' -f1)
        _expire_ts=$(echo "$_info" | cut -d'|' -f2)
        _remaining=$(echo "$_info" | cut -d'|' -f3)
        _used=$(echo "$_info" | cut -d'|' -f4)
        _total=$(echo "$_info" | cut -d'|' -f5)

        # Skip if no expiry info found
        [ "$_expire_ts" = "0" ] || [ -z "$_expire_ts" ] && continue

        # Check if already expired
        if [ "$_remaining" != "N/A" ] && [ "$_remaining" -lt 0 ] 2>/dev/null; then
            _alerts="${_alerts}🔴 ${_name} 已过期 ${_remaining} 天\n"
            _level="error"
            _alert_count=$(( _alert_count + 1 ))
            continue
        fi

        # Check if within remind window
        if [ "$_remaining" != "N/A" ] && [ "$_remaining" -le "$_remind_days" ] 2>/dev/null && [ "$_remaining" -ge 0 ] 2>/dev/null; then
            local _traffic_msg=""
            if [ -n "$_used" ] && [ -n "$_total" ]; then
                local _used_hr _total_hr
                _used_hr=$(format_traffic "$_used")
                _total_hr=$(format_traffic "$_total")
                _traffic_msg="（已用 ${_used_hr} / ${_total_hr}）"
            fi

            _alerts="${_alerts}⚠️ ${_name} 将在 ${_remaining} 天后到期${_traffic_msg}\n"
            [ "$_level" = "info" ] && _level="warn"
            _alert_count=$(( _alert_count + 1 ))
        fi
    done

    if [ "$_alert_count" -gt 0 ]; then
        local _msg
        _msg=$(printf "📅 *订阅到期提醒*\n━━━━━━━━━━━━━━━━━━\n\n%s" "$_alerts")

        eventcenter emit sub "expiry_reminder" "$_level" \
            "订阅到期提醒" "$_msg"
    fi

    return 0
}

# CLI entry — only runs when script is executed directly
if [ $# -gt 0 ]; then
    case "$1" in
        check)  check ;;
        *)      check ;;
    esac
fi
