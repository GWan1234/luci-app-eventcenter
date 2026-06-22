#!/bin/sh
# Event Center - Node Health Event Source
# Monitors OpenClash proxy group selections via Clash API
# Detects automatic failover and recovery, sends notifications

# get_clash_secret
get_clash_secret() {
    uci -q get openclash.config.dashboard_password 2>/dev/null
}

# get_clash_port
get_clash_port() {
    local _ec_port
    _ec_port=$(grep -o 'external-controller:[^:]*:\([0-9]*\)' /etc/openclash/config/*.yaml 2>/dev/null | head -1 | grep -o '[0-9]*$')
    echo "${_ec_port:-9090}"
}

# fetch_proxies_json
fetch_proxies_json() {
    local _secret _port _url _hdr
    _secret=$(get_clash_secret)
    _port=$(get_clash_port)
    _url="http://127.0.0.1:${_port}/proxies"
    _hdr="Authorization: Bearer ${_secret}"

    curl -s -m 10 -H "$_hdr" "$_url" 2>/dev/null
}

# test_node_delay <node_name>
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
extract_urltest_groups() {
    local _json="$1"
    printf '%s' "$_json" | sed 's/},/}\n/g' | grep '"type":"URLTest"' | while IFS= read -r _rec; do
        local _n _w
        _n=$(echo "$_rec" | grep -o '"name":"[^"]*"' | head -1 | sed 's/"name":"//;s/"//g')
        _w=$(echo "$_rec" | grep -o '"now":"[^"]*"' | head -1 | sed 's/"now":"//;s/"//g')
        [ -n "$_n" ] && [ -n "$_w" ] && printf '%s\t%s\n' "$_n" "$_w"
    done
}

# check()
check() {
    local _state_file
    _state_file=$(ec_uci_get "node_health.state_file" "/tmp/eventcenter_node_state")

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

    # Compare current vs old, detect failovers
    local _tmp_changes="/tmp/ec_health_changes_$$"
    : > "$_tmp_changes"

    while IFS=$(printf '\t') read -r _group _current_node; do
        [ -z "$_group" ] || [ -z "$_current_node" ] && continue

        local _old_node
        _old_node=$(grep "^${_group}$(printf '\t')" "$_tmp_old" 2>/dev/null | cut -f2)

        # Skip if no previous record or same node
        [ -z "$_old_node" ] && continue
        [ "$_current_node" = "$_old_node" ] && continue

        # Node changed! Check if original node is unreachable
        local _delay
        _delay=$(test_node_delay "$_old_node")

        if [ "$_delay" = "timeout" ]; then
            printf '%s\t%s\t%s\n' "$_group" "$_old_node" "$_current_node" >> "$_tmp_changes"
        fi
    done < "$_tmp_current"

    # Send notification if there are failovers
    if [ -s "$_tmp_changes" ]; then
        local _tmp_awk2="/tmp/ec_hawk2_$$"
        cat > "$_tmp_awk2" << 'AWKEOF2'
BEGIN {
    printf "\xf0\x9f\x9b\xa1\xef\xb8\x8f *节点自动切换*\n\n"
    cmd = "date +\"%Y-%m-%d %H:%M:%S\""
    cmd | getline ts; close(cmd)
    printf "\xf0\x9f\x93\x85 %s\n\n", ts
}
{
    printf "%s\n", $1
    printf "  \xe2\x9d\x8c %s (不可达)\n", $2
    printf "  \xe2\x86\x92 \xe2\x9c\x85 %s\n\n", $3
}
AWKEOF2
        local _msg
        _msg=$(awk -F'\t' -f "$_tmp_awk2" "$_tmp_changes")

        if [ -n "$_msg" ]; then
            eventcenter emit openclash "node_failover" warn \
                "节点自动切换" \
                "$_msg"
        fi
        rm -f "$_tmp_awk2"
    fi

    # Update state file
    cat "$_tmp_current" > "$_state_file"

    # Cleanup
    rm -f "$_tmp_current" "$_tmp_old" "$_tmp_changes"

    return 0
}
