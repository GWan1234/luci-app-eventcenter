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

get_clash_secret() {
    uci -q get openclash.config.dashboard_password 2>/dev/null
}

get_clash_port() {
    local _ec_port
    _ec_port=$(grep -o 'external-controller:[^:]*:\([0-9]*\)' /etc/openclash/config/*.yaml 2>/dev/null | head -1 | grep -o '[0-9]*$')
    echo "${_ec_port:-9090}"
}

fetch_proxies_json() {
    local _secret _port _url _hdr
    _secret=$(get_clash_secret)
    _port=$(get_clash_port)
    _url="http://127.0.0.1:${_port}/proxies"
    _hdr="Authorization: Bearer ${_secret}"

    curl -s -m 10 -H "$_hdr" "$_url" 2>/dev/null
}

# test_node_delay <node_name>
# Returns delay in ms, or "timeout" if unreachable
test_node_delay() {
    local _node="$1" _secret _port _url _test_url _timeout _hdr _result _delay
    _secret=$(get_clash_secret)
    _port=$(get_clash_port)
    _test_url=$(ec_uci_get "node_health.test_url" "http://www.gstatic.com/generate_204")
    _timeout=$(ec_uci_get "node_health.delay_threshold" "3000")
    _hdr="Authorization: Bearer ${_secret}"

    local _encoded
    _encoded=$(printf '%s' "$_node" | sed 's/ /%20/g; s/&/%26/g; s/+/%2B/g; s/,/%2C/g; s/:/%3A/g; s/;/%3B/g; s/=/%3D/g; s/?/%3F/g; s/@/%40/g')

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

# --- Main check ---

check() {
    local _state_file _failed_file
    _state_file=$(ec_uci_get "node_health.state_file" "/tmp/eventcenter_node_state")
    _failed_file="/tmp/eventcenter_node_failed"

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
        cat "$_tmp_current" > "$_state_file"
        logger -t eventcenter "node-health: baseline saved ($(wc -l < "$_tmp_current") groups)"
        rm -f "$_tmp_current" "$_tmp_old"
        return 0
    fi

    # Compare current vs old, detect failovers and recoveries
    local _tmp_failovers="/tmp/ec_health_failovers_$$"
    local _tmp_recoveries="/tmp/ec_health_recoveries_$$"
    : > "$_tmp_failovers"
    : > "$_tmp_recoveries"

    while IFS=$(printf '\t') read -r _group _current_node; do
        [ -z "$_group" ] || [ -z "$_current_node" ] && continue

        local _old_node
        _old_node=$(fgrep -F "${_group}$(printf '\t')" "$_tmp_old" 2>/dev/null | cut -f2)

        # Skip if no previous record or same node
        [ -z "$_old_node" ] && continue
        [ "$_current_node" = "$_old_node" ] && continue

        # Node changed! Check if original node is unreachable
        local _delay
        _delay=$(test_node_delay "$_old_node")

        if [ "$_delay" = "timeout" ]; then
            # Failover: old node unreachable
            printf '%s\t%s\t%s\n' "$_group" "$(prepend_flag "$_old_node")" "$(prepend_flag "$_current_node")" >> "$_tmp_failovers"
            # Record failed node for recovery tracking
            echo "${_group}$(printf '\t')${_old_node}" >> "$_failed_file"
        else
            # Node changed but old node is still reachable — likely manual switch or mihomo routine
            # Check if this is a recovery (node was previously failed)
            if [ -f "$_failed_file" ] && fgrep -qF "${_group}$(printf '\t')${_current_node}" "$_failed_file" 2>/dev/null; then
                # Recovery: previously failed node is back
                printf '%s\t%s\t%s\n' "$_group" "$(prepend_flag "$_old_node")" "$(prepend_flag "$_current_node")" >> "$_tmp_recoveries"
                # Remove from failed list
                fgrep -vF "${_group}$(printf '\t')${_current_node}" "$_failed_file" > "/tmp/ec_failed_tmp_$$" 2>/dev/null
                mv "/tmp/ec_failed_tmp_$$" "$_failed_file"
            fi
            # Otherwise: manual switch or routine — don't notify
        fi
    done < "$_tmp_current"

    # Build and send failover notification
    if [ -s "$_tmp_failovers" ]; then
        local _tmp_awk="/tmp/ec_hawk_$$"
        cat > "$_tmp_awk" << 'AWKEOF'
BEGIN {
    printf "\xf0\x9f\x9b\xa1\xef\xb8\x8f *节点自动切换*\n\n"
    cmd = "date +\"%Y-%m-%d %H:%M:%S\""
    cmd | getline ts; close(cmd)
    printf "\xf0\x9f\x93\x85 %s\n\n", ts
}
{
    printf "%s\n", $1
    printf "  \xe2\x9d\x8c %s (\xe4\xb8\x8d\xe5\x8f\xaf\xe8\xbe\xbe)\n", $2
    printf "  \xe2\x86\x92 \xe2\x9c\x85 %s\n\n", $3
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
    printf "\xe2\x9c\x85 *节点恢复*\n\n"
    cmd = "date +\"%Y-%m-%d %H:%M:%S\""
    cmd | getline ts; close(cmd)
    printf "\xf0\x9f\x93\x85 %s\n\n", ts
}
{
    printf "%s\n", $1
    printf "  \xf0\x9f\x94\x84 %s \xe2\x86\x92 %s\n\n", $2, $3
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

    # Update state file
    cat "$_tmp_current" > "$_state_file"

    # Cleanup
    rm -f "$_tmp_current" "$_tmp_old" "$_tmp_failovers" "$_tmp_recoveries"

    return 0
}
