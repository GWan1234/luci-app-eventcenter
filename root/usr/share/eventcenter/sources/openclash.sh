#!/bin/sh
# Event Center - OpenClash Event Source
# Monitors OpenClash subscription configs per-subscription
# Each config file = one subscription, separate notifications

# extract_node_names <file>
extract_node_names() {
    local _file="$1"
    awk '
        /^proxies:/ { in_proxies=1; next }
        /^(proxy-groups|rules):/ { in_proxies=0 }
        in_proxies && /name:/ {
            line=$0
            sub(/.*name:[[:space:]]*/, "", line)
            sub(/,.*/, "", line)
            gsub(/[\047"]/, "", line)
            if (line !~ /(剩余|到期|套餐|距离|故障|充值|流量|重置|过期|expire|traffic|reset|servername)/ && line != "")
                print line
        }
    ' "$_file" 2>/dev/null
}

# (detect_region, region_emoji, prepend_flag are now in utils.sh)

# build_notification <title> <old_total> <new_total> <added_count> <removed_count> <modified_count> <region_lines> <new_regions> <gone_regions> <added_list> <removed_list> <modified_list>
# Builds the formatted Telegram message using awk
build_notification() {
    local _title="$1" _old="$2" _new="$3"
    local _added="$4" _removed="$5" _modified="$6"
    local _regions="$7" _new_regions="$8" _gone_regions="$9"
    shift 9
    local _added_list="$1" _removed_list="$2" _modified_list="$3"

    local _ts _diff_str _diff
    _ts=$(date '+%Y-%m-%d %H:%M:%S')
    _diff=$(( _new - _old ))
    [ "$_diff" -ge 0 ] 2>/dev/null && _diff_str="+${_diff}" || _diff_str="${_diff}"

    awk -v title="$_title" -v ts="$_ts" \
        -v old="$_old" -v new="$_new" -v diff="$_diff_str" \
        -v added="$_added" -v removed="$_removed" -v modified="$_modified" \
        -v regions="$_regions" \
        -v new_regions="$_new_regions" -v gone_regions="$_gone_regions" \
        -v added_list="$_added_list" -v removed_list="$_removed_list" -v modified_list="$_modified_list" \
        'BEGIN {
            emoji_for = "HK=🇭🇰 TW=🇨🇳 JP=🇯🇵 SG=🇸🇬 US=🇺🇸 KR=🇰🇷 DE=🇩🇪 FR=🇫🇷 UK=🇬🇧 NL=🇳🇱 IN=🇮🇳 CL=🇨🇱 BR=🇧🇷 ES=🇪🇸 CH=🇨🇭 SE=🇸🇪 MX=🇲🇽 CA=🇨🇦 AU=🇦🇺 RU=🇷🇺 TR=🇹🇷 AR=🇦🇷 IT=🇮🇹"
            n_emoji = split(emoji_for, ef_arr, " ")
            for (i = 1; i <= n_emoji; i++) {
                split(ef_arr[i], kv, "=")
                em[kv[1]] = kv[2]
            }

            printf "🟡📦 *%s*\n🟡━━━━━━━━━━━━━━━━━━\n📅 %s\n\n📦 *节点总数*\n%s → %s (%s)\n\n📊 *变更统计*\n➕ 新增线路 %s\n➖ 下线线路 %s\n🔄 参数更新 %s", title, ts, old, new, diff, added, removed, modified

            has_region = 0
            if (new_regions != "" || gone_regions != "" || regions != "") has_region = 1

            if (has_region) printf "\n\n🌎 *地区变化*"

            if (new_regions != "") {
                n = split(new_regions, nr, "\n")
                for (i = 1; i <= n; i++) {
                    code = nr[i]; if (code == "") continue
                    e = (code in em) ? em[code] : code
                    printf "\n🚀 %s %s 新地区上线", e, code
                }
            }
            if (gone_regions != "") {
                n = split(gone_regions, gr, "\n")
                for (i = 1; i <= n; i++) {
                    code = gr[i]; if (code == "") continue
                    e = (code in em) ? em[code] : code
                    printf "\n⚠️ %s %s 地区缩减", e, code
                }
            }
            if (regions != "") {
                n = split(regions, lines, "\n")
                for (i = 1; i <= n; i++) {
                    split(lines[i], parts, " ")
                    code = parts[1]; delta = parts[2]
                    e = (code in em) ? em[code] : code
                    printf "\n%s %s %s", e, code, delta
                }
            }

            if (added_list != "" || removed_list != "" || modified_list != "") {
                printf "\n\n📋 *主要变化*"
                if (added_list != "") printf "\n%s", added_list
                if (removed_list != "") printf "\n%s", removed_list
                if (modified_list != "") printf "\n%s", modified_list
            }
        }'
}

# check_subscription <config_file> <state_file>
# Checks a single subscription config for changes, emits notification if changed
check_subscription() {
    local _config="$1"
    local _state_file="$2"
    local _first_run=0
    local _sub_name

    # Extract subscription name from filename
    _sub_name=$(basename "$_config" .yaml)
    _sub_name=$(basename "$_sub_name" .yml)

    # Discover provider files for this config
    local _tmp_providers="/tmp/ec_prov_${_sub_name}_$$"
    : > "$_tmp_providers"

    grep -A10 'proxy-providers:' "$_config" 2>/dev/null | grep 'path:' | sed "s/.*path:[[:space:]]*//;s/['\"]//g;s/.*\///" | while read -r _p; do
        local _pp="/etc/openclash/proxy_provider/$_p"
        [ -f "$_pp" ] && echo "$_pp"
    done >> "$_tmp_providers"

    [ -s "$_tmp_providers" ] || { rm -f "$_tmp_providers"; return 0; }

    # Build current node hash list
    local _tmp_current="/tmp/ec_curr_${_sub_name}_$$"
    : > "$_tmp_current"

    while IFS= read -r _pf; do
        [ -z "$_pf" ] || [ ! -f "$_pf" ] && continue
        awk '
            /^proxies:/ { in_p=1; next }
            /^(proxy-groups|rules):/ { in_p=0 }
            in_p && /name:/ {
                line=$0; sub(/.*name:[[:space:]]*/, "", line); sub(/,.*/, "", line); gsub(/[\047"]/, "", line)
                if (line ~ /(剩余|到期|套餐|距离|故障|充值|流量|重置|过期|expire|traffic|reset|servername)/ || line == "") next
                server=""; port=""
                n=split($0, fields, ",")
                for (i=1; i<=n; i++) {
                    gsub(/^[[:space:]]+/, "", fields[i])
                    if (fields[i] ~ /^server:/) { sub(/.*server:[[:space:]]*/, "", fields[i]); server=fields[i] }
                    if (fields[i] ~ /^port:/) { sub(/.*port:[[:space:]]*/, "", fields[i]); port=fields[i] }
                }
                key = server ":" port; if (key == ":") key = "unknown"
                print line "\t" key
            }
        ' "$_pf" 2>/dev/null >> "$_tmp_current"
    done < "$_tmp_providers"

    local _current_total
    _current_total=$(wc -l < "$_tmp_current" 2>/dev/null || echo 0)

    # Load old state for this subscription
    local _tmp_old="/tmp/ec_old_${_sub_name}_$$"
    : > "$_tmp_old"

    if [ -f "$_state_file" ]; then
        grep "^nodehash:" "$_state_file" 2>/dev/null | sed 's/^nodehash://' > "$_tmp_old"
    fi

    local _old_total
    _old_total=$(wc -l < "$_tmp_old" 2>/dev/null || echo 0)

    # First run: build baseline only
    if [ ! -f "$_state_file" ]; then
        # Save baseline
        local _tmp_state="${_state_file}.tmp"
        : > "$_tmp_state"
        awk -F'\t' '{printf "nodehash:%s\t%s\n", $1, $2}' "$_tmp_current" >> "$_tmp_state"
        mkdir -p "$(dirname "$_state_file")" 2>/dev/null
        mv "$_tmp_state" "$_state_file" 2>/dev/null
        rm -f "$_tmp_providers" "$_tmp_current" "$_tmp_old"
        return 0
    fi

    # Three-way diff
    local _tmp_diff="/tmp/ec_diff_${_sub_name}_$$"
    awk -F'\t' '
        NR==FNR { old_key[$1]=$2; next }
        { new_key[$1]=$2 }
        END {
            for (n in new_key) {
                if (!(n in old_key)) printf "A\t%s\n", n
                else if (new_key[n] != old_key[n]) printf "M\t%s\n", n
            }
            for (n in old_key) {
                if (!(n in new_key)) printf "R\t%s\n", n
            }
        }
    ' "$_tmp_old" "$_tmp_current" > "$_tmp_diff"

    local _tmp_added="/tmp/ec_add_${_sub_name}_$$"
    local _tmp_removed="/tmp/ec_rem_${_sub_name}_$$"
    local _tmp_modified="/tmp/ec_mod_${_sub_name}_$$"

    grep "^A	" "$_tmp_diff" 2>/dev/null | cut -f2 > "$_tmp_added"
    grep "^R	" "$_tmp_diff" 2>/dev/null | cut -f2 > "$_tmp_removed"
    grep "^M	" "$_tmp_diff" 2>/dev/null | cut -f2 > "$_tmp_modified"

    local _added_count _removed_count _modified_count
    _added_count=$(wc -l < "$_tmp_added" 2>/dev/null || echo 0)
    _removed_count=$(wc -l < "$_tmp_removed" 2>/dev/null || echo 0)
    _modified_count=$(wc -l < "$_tmp_modified" 2>/dev/null || echo 0)

    if [ "$_added_count" -gt 0 ] 2>/dev/null || [ "$_removed_count" -gt 0 ] 2>/dev/null || [ "$_modified_count" -gt 0 ] 2>/dev/null; then
        # Build region changes
        local _tmp_regions="/tmp/ec_regs_${_sub_name}_$$"
        : > "$_tmp_regions"

        for _f in "$_tmp_added" "$_tmp_removed" "$_tmp_modified"; do
            [ -s "$_f" ] || continue
            _sign="+"; [ "$_f" = "$_tmp_removed" ] && _sign="-"
            while IFS= read -r _name; do
                [ -z "$_name" ] && continue
                _r=$(detect_region "$_name")
                [ -n "$_r" ] && echo "${_r} ${_sign}1"
            done < "$_f"
        done > "$_tmp_regions"

        local _region_lines=""
        if [ -s "$_tmp_regions" ]; then
            _region_lines=$(awk '{split($0,a," "); r=a[1]; v=a[2]+0; sums[r]+=v} END{for(r in sums){v=sums[r]; if(v>0) printf "%s +%d\n",r,v; else if(v<0) printf "%s %d\n",r,v}}' "$_tmp_regions")
        fi

        # Detect new/gone regions
        local _tmp_oldr="/tmp/ec_oldr_${_sub_name}_$$"
        local _tmp_newr="/tmp/ec_newr_${_sub_name}_$$"
        : > "$_tmp_oldr"; : > "$_tmp_newr"

        while IFS= read -r _name; do
            [ -z "$_name" ] && continue; detect_region "$_name"
        done < "$_tmp_old" | sort -u > "$_tmp_oldr"

        while IFS= read -r _line; do
            [ -z "$_line" ] && continue; _name=$(echo "$_line" | cut -f1); detect_region "$_name"
        done < "$_tmp_current" | sort -u > "$_tmp_newr"

        local _new_regions_online=""
        [ -s "$_tmp_newr" ] && _new_regions_online=$(grep -vxFf "$_tmp_oldr" "$_tmp_newr" 2>/dev/null)

        local _regions_gone=""
        [ -s "$_tmp_oldr" ] && _regions_gone=$(grep -vxFf "$_tmp_newr" "$_tmp_oldr" 2>/dev/null)

        # Build change lists (prepend flag emoji for names without one)
        local _added_list _removed_list _modified_list
        _added_list=$(head -5 "$_tmp_added" 2>/dev/null | while IFS= read -r _n; do
            [ -z "$_n" ] && continue
            printf "  + %s\n" "$(prepend_flag "$_n")"
        done)
        _removed_list=$(head -5 "$_tmp_removed" 2>/dev/null | while IFS= read -r _n; do
            [ -z "$_n" ] && continue
            printf "  - %s\n" "$(prepend_flag "$_n")"
        done)
        _modified_list=$(head -5 "$_tmp_modified" 2>/dev/null | while IFS= read -r _n; do
            [ -z "$_n" ] && continue
            printf "  ~ %s\n" "$(prepend_flag "$_n")"
        done)

        # Generate and send notification
        local _msg
        _msg=$(build_notification "$_sub_name" "$_old_total" "$_current_total" \
            "$_added_count" "$_removed_count" "$_modified_count" \
            "$_region_lines" "$_new_regions_online" "$_regions_gone" \
            "$_added_list" "$_removed_list" "$_modified_list")

        eventcenter emit openclash "config_change_${_sub_name}" info \
            "$_sub_name 订阅更新" \
            "$_msg" \
            "ec:配置变更"

        rm -f "$_tmp_regions" "$_tmp_oldr" "$_tmp_newr"
    fi

    # Update state file
    local _tmp_state="${_state_file}.tmp"
    : > "$_tmp_state"
    awk -F'\t' '{printf "nodehash:%s\t%s\n", $1, $2}' "$_tmp_current" >> "$_tmp_state"
    mkdir -p "$(dirname "$_state_file")" 2>/dev/null
    mv "$_tmp_state" "$_state_file" 2>/dev/null

    # Cleanup
    rm -f "$_tmp_providers" "$_tmp_current" "$_tmp_old" "$_tmp_diff" "$_tmp_added" "$_tmp_removed" "$_tmp_modified"

    return 0
}

# check()
# Main entry: iterates each config file as a separate subscription
check() {
    local _state_dir
    _state_dir=$(ec_uci_get "openclash.state_dir" "/tmp/eventcenter_openclash")

    # Discover config files
    local _config_files=""
    local _paths
    _paths=$(uci -q get eventcenter.@monitor[0].paths 2>/dev/null)
    if [ -n "$_paths" ]; then
        _config_files=$(echo "$_paths" | tr ',' '\n')
    else
        [ -d "/etc/openclash/config" ] && _config_files=$(find /etc/openclash/config -maxdepth 1 -name '*.yaml' -type f 2>/dev/null)
    fi
    [ -z "$_config_files" ] && return 0

    mkdir -p "$_state_dir" 2>/dev/null

    local _cf
    for _cf in $_config_files; do
        [ -z "$_cf" ] || [ ! -f "$_cf" ] && continue
        local _sub_name _state_file
        _sub_name=$(basename "$_cf" .yaml)
        _state_file="${_state_dir}/${_sub_name}.state"
        check_subscription "$_cf" "$_state_file"
    done

    return 0
}
