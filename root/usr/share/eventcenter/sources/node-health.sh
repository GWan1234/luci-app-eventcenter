#!/bin/sh
# Event Center - Node Health Event Source
# Monitors OpenClash proxy group selections via Clash API
# Detects automatic failover and recovery, sends notifications

# --- Region detection (shared with openclash.sh) ---

detect_region() {
    echo "$1" | awk '{
        n = $0
        if      (index(n, "新加坡") || index(n, "狮城"))  print "SG"
        else if (index(n, "加拿大"))                        print "CA"
        else if (index(n, "澳大利亚") || index(n, "澳洲"))  print "AU"
        else if (index(n, "香港"))                          print "HK"
        else if (index(n, "台湾"))                          print "TW"
        else if (index(n, "日本"))                          print "JP"
        else if (index(n, "美国"))                          print "US"
        else if (index(n, "韩国"))                          print "KR"
        else if (index(n, "德国"))                          print "DE"
        else if (index(n, "法国"))                          print "FR"
        else if (index(n, "英国"))                          print "UK"
        else if (index(n, "荷兰"))                          print "NL"
        else if (index(n, "印度"))                          print "IN"
        else if (index(n, "智利"))                          print "CL"
        else if (index(n, "巴西"))                          print "BR"
        else if (index(n, "西班牙"))                        print "ES"
        else if (index(n, "瑞士"))                          print "CH"
        else if (index(n, "瑞典"))                          print "SE"
        else if (index(n, "墨西哥"))                        print "MX"
        else if (index(n, "俄罗斯"))                        print "RU"
        else if (index(n, "土耳其"))                        print "TR"
        else if (index(n, "阿根廷"))                        print "AR"
        else if (index(n, "意大利"))                        print "IT"
    }'
}

region_emoji() {
    case "$1" in
        HK) printf '🇭🇰' ;; TW) printf '🇨🇳' ;; JP) printf '🇯🇵' ;;
        SG) printf '🇸🇬' ;; US) printf '🇺🇸' ;; KR) printf '🇰🇷' ;;
        DE) printf '🇩🇪' ;; FR) printf '🇫🇷' ;; UK) printf '🇬🇧' ;;
        NL) printf '🇳🇱' ;; IN) printf '🇮🇳' ;; CL) printf '🇨🇱' ;;
        BR) printf '🇧🇷' ;; ES) printf '🇪🇸' ;; CH) printf '🇨🇭' ;;
        SE) printf '🇸🇪' ;; MX) printf '🇲🇽' ;; CA) printf '🇨🇦' ;;
        AU) printf '🇦🇺' ;; RU) printf '🇷🇺' ;; TR) printf '🇹🇷' ;;
        AR) printf '🇦🇷' ;; IT) printf '🇮🇹' ;; *) printf '%s' "$1" ;;
    esac
}

prepend_flag() {
    local _name="$1"
    case "$_name" in
        🇦*|🇧*|🇨*|🇩*|🇪*|🇫*|🇬*|🇭*|🇮*|🇯*|🇰*|🇱*|🇲*|🇳*|🇴*|🇵*|🇶*|🇷*|🇸*|🇹*|🇺*|🇻*|🇼*|🇽*|🇾*|🇿*)
            echo "$_name"
            return
            ;;
    esac
    local _r
    _r=$(detect_region "$_name")
    if [ -n "$_r" ]; then
        local _emoji
        _emoji=$(region_emoji "$_r")
        echo "${_emoji} ${_name}"
    else
        echo "$_name"
    fi
}

# --- Clash API helpers ---

get_clash_port() {
    local _ec_port
    _ec_port=$(grep -o 'external-controller:[^:]*:\([0-9]*\)' /etc/openclash/config/*.yaml 2>/dev/null | head -1 | grep -o '[0-9]*$')
    echo "${_ec_port:-9090}"
}

fetch_proxies_json() {
    local _port _url _hdr
    _port=$(get_clash_port)
    _url="http://127.0.0.1:${_port}/proxies"
    _hdr=$(/usr/share/eventcenter/auth_header.sh)
    curl -s -m 10 -H "$_hdr" "$_url" 2>/dev/null
}/proxies"
    _hdr="Authorization: Bearer ***    curl -s -m 10 -H "$_hdr" "$_url" 2>/dev/null
}

# test_node_delay <node_name>
# Returns delay in ms, or "timeout" if unreachable
test_node_delay() {
    local _node="$1" _port _url _test_url _timeout _hdr _result _delay
    _port=$(get_clash_port)
    _test_url=$(ec_uci_get "node_health.test_url" "http://www.gstatic.com/generate_204")
    _timeout=$(ec_uci_get "node_health.delay_threshold" "3000")
    _hdr=$(/usr/share/eventcenter/auth_header.sh)

    local _encoded=$(printf '%s' "$_node" | sed 's/ /%20/g; s/&/%26/g; s/+/%2B/g; s/,/%2C/g; s/:/%3A/g; s/;/%3B/g; s/=/%3D/g; s/?/%3F/g; s/@/%40/g')

    _url="http://127.0.0.1:${_port}/proxies/${_encoded}/delay?timeout=${_timeout}&url=${_test_url}"

    _result=$(curl -s -m $((_timeout / 1000 + 5)) -H "$_hdr" "$_url" 2>/dev/null)

    _delay=$(echo "$_result" | grep -o '"delay":[0-9]*' | grep -o '[0-9]*')
    if [ -n "$_delay" ]; then
        echo "$_delay"
    else
        echo "timeout"
    fi
}

# extract_urltest_groups <json>
# Outputs: group_name\tnow_node
extract_urltest_groups() {
    local _json="$1"
    printf '%s' "$_json" | sed 's/},/}\n/g' | grep '"type":"URLTest"' | while IFS= read -r _rec; do
        local _n _w
        _n=$(echo "$_rec" | grep -o '"name":"[^"]*"' | head -1 | sed 's/"name":"//;s/"//g')
        _w=$(echo "$_rec" | grep -o '"now":"[^"]*"' | head -1 | sed 's/"now":"//;s/"//g')
        [ -n "$_n" ] && [ -n "$_w" ] && printf '%s\t%s\n' "$_n" "$_w"
    done
}

# group_in_filter <group_name>
# Returns 0 if group should be monitored (empty filter = all)
group_in_filter() {
    local _group="$1" _filter
    _filter=$(ec_uci_get "node_health.monitor_groups" "")
    [ -z "$_filter" ] && return 0  # empty = monitor all
    echo "$_filter" | tr ',' '\n' | fgrep -qF "$_group"
}

# record_latency <group> <node> <delay_ms>
record_latency() {
    local _group="$1" _node="$2" _delay="$3" _latency_file
    _latency_file="/etc/eventcenter/latency_history"
    mkdir -p /etc/eventcenter 2>/dev/null
    local _ts
    _ts=$(date '+%Y-%m-%d %H:%M:%S')
    printf '%s\t%s\t%s\t%s\n' "$_ts" "$_group" "$_node" "$_delay" >> "$_latency_file"
    # Keep last 1000 entries
    if [ "$(wc -l < "$_latency_file" 2>/dev/null)" -gt 1000 ]; then
        tail -500 "$_latency_file" > "${_latency_file}.tmp"
        mv "${_latency_file}.tmp" "$_latency_file"
    fi
}

# --- Main check ---

check() {
    local _state_file _failed_file
    _state_file=$(ec_uci_get "node_health.state_file" "/tmp/eventcenter_node_state")
    _failed_file="/etc/eventcenter/failed_nodes"
    mkdir -p /etc/eventcenter 2>/dev/null

    local _enable
    _enable=$(ec_uci_get "node_health.enable" "0")
    [ "$_enable" != "1" ] && return 0

    # Fetch proxy groups from Clash API
    local _json
    _json=$(fetch_proxies_json)
    if [ -z "$_json" ]; then
        logger -t eventcenter "node-health: failed to reach Clash API"
        return 1
    fi

    if ! echo "$_json" | grep -q '"proxies"'; then
        logger -t eventcenter "node-health: invalid API response"
        return 1
    fi

    # Extract url-test groups
    local _tmp_current="/tmp/ec_health_current_$$"
    extract_urltest_groups "$_json" > "$_tmp_current"

    [ -s "$_tmp_current" ] || { rm -f "$_tmp_current"; return 0; }

    # Load previous state
    local _tmp_old="/tmp/ec_health_old_$$"
    : > "$_tmp_old"
    [ -f "$_state_file" ] && cat "$_state_file" > "$_tmp_old"

    # First run: save baseline, don't notify
    if [ ! -f "$_state_file" ]; then
        cp "$_tmp_current" "${_state_file}.tmp" && mv "${_state_file}.tmp" "$_state_file"
        logger -t eventcenter "node-health: baseline saved ($(wc -l < "$_tmp_current") groups)"
        rm -f "$_tmp_current" "$_tmp_old"
        return 0
    fi

    # Check if recovery notification is enabled
    local _notify_recovery
    _notify_recovery=$(ec_uci_get "node_health.notify_recovery" "1")

    # Compare current vs old, detect failovers and recoveries
    local _tmp_failovers="/tmp/ec_health_failovers_$$"
    local _tmp_recoveries="/tmp/ec_health_recoveries_$$"
    : > "$_tmp_failovers"
    : > "$_tmp_recoveries"

    while IFS=$(printf '\t') read -r _group _current_node; do
        [ -z "$_group" ] || [ -z "$_current_node" ] && continue

        # Group filter
        group_in_filter "$_group" || continue

        local _old_node
        _old_node=$(fgrep -F "${_group}$(printf '\t')" "$_tmp_old" 2>/dev/null | cut -f2)

        # Skip if no previous record or same node
        [ -z "$_old_node" ] && continue
        [ "$_current_node" = "$_old_node" ] && continue

        # Node changed! Check if original node is unreachable
        local _delay
        _delay=$(test_node_delay "$_old_node")

        # Record latency for current node
        local _current_delay
        _current_delay=$(test_node_delay "$_current_node")
        [ "$_current_delay" != "timeout" ] && record_latency "$_group" "$_current_node" "$_current_delay"

        if [ "$_delay" = "timeout" ]; then
            # Failover: old node unreachable — dedup by group:old_node
            local _dedup_key
            _dedup_key=$(printf '%s:%s' "$_group" "$_old_node" | md5sum 2>/dev/null | cut -d' ' -f1)
            if dedup_check "node_failover" "$_dedup_key" 2>/dev/null; then
                printf '%s\t%s\t%s\n' "$_group" "$(prepend_flag "$_old_node")" "$(prepend_flag "$_current_node")" >> "$_tmp_failovers"
            fi
            # Record failed node for recovery tracking (append if not exists)
            if ! fgrep -qF "${_group}$(printf '\t')${_old_node}" "$_failed_file" 2>/dev/null; then
                echo "${_group}$(printf '\t')${_old_node}" >> "$_failed_file"
            fi
        else
            # Node changed but old node is still reachable
            # Check if this is a recovery (node was previously failed)
            if [ "$_notify_recovery" = "1" ] && [ -f "$_failed_file" ] && fgrep -qF "${_group}$(printf '\t')${_current_node}" "$_failed_file" 2>/dev/null; then
                # Recovery: previously failed node is back — dedup by group:node
                local _dedup_key_r
                _dedup_key_r=$(printf '%s:%s:recovery' "$_group" "$_current_node" | md5sum 2>/dev/null | cut -d' ' -f1)
                if dedup_check "node_recovery" "$_dedup_key_r" 2>/dev/null; then
                    printf '%s\t%s\t%s\n' "$_group" "$(prepend_flag "$_old_node")" "$(prepend_flag "$_current_node")" >> "$_tmp_recoveries"
                fi
                # Remove from failed list
                fgrep -vF "${_group}$(printf '\t')${_current_node}" "$_failed_file" > "/tmp/ec_failed_tmp_$$" 2>/dev/null
                mv "/tmp/ec_failed_tmp_$$" "$_failed_file"
            fi
        fi
    done < "$_tmp_current"

    # Build and send failover notification
    if [ -s "$_tmp_failovers" ]; then
        local _tmp_awk="/tmp/ec_hawk_$$"
        cat > "$_tmp_awk" << 'AWKEOF'
BEGIN {
    printf "🚤 *节点自动切换*\n"
    cmd = "date +\"%H:%M\""
    cmd | getline ts; close(cmd)
}
{
    printf "\n*%s*\n", $1
    printf "  ❌ ~~%s~~\n", $2
    printf "  → ✅ %s\n", $3
}
END {
    printf "\n`%s`\n", ts
}
AWKEOF
        local _msg
        _msg=$(awk -F'\t' -f "$_tmp_awk" "$_tmp_failovers")

        if [ -n "$_msg" ]; then
            eventcenter emit openclash "node_failover" warn \
                "节点自动切换" \
                "$_msg"
        fi
        rm -f "$_tmp_awk"
    fi

    # Build and send recovery notification
    if [ -s "$_tmp_recoveries" ]; then
        local _tmp_awk_r="/tmp/ec_hawkr_$$"
        cat > "$_tmp_awk_r" << 'AWKEOFR'
BEGIN {
    printf "💚 *节点恢复*\n"
    cmd = "date +\"%H:%M\""
    cmd | getline ts; close(cmd)
}
{
    printf "\n*%s*\n", $1
    printf "  🔄 %s → %s\n", $2, $3
}
END {
    printf "\n`%s`\n", ts
}
AWKEOFR
        local _msg_r
        _msg_r=$(awk -F'\t' -f "$_tmp_awk_r" "$_tmp_recoveries")

        if [ -n "$_msg_r" ]; then
            eventcenter emit openclash "node_recovery" info \
                "节点恢复" \
                "$_msg_r"
        fi
        rm -f "$_tmp_awk_r"
    fi

    # Update state file (atomic write)
    cp "$_tmp_current" "${_state_file}.tmp" && mv "${_state_file}.tmp" "$_state_file"

    # Cleanup
    rm -f "$_tmp_current" "$_tmp_old" "$_tmp_failovers" "$_tmp_recoveries"

    return 0
}
