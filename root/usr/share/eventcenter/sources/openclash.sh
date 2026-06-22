#!/bin/sh
# Event Center - OpenClash Event Source
# Monitors OpenClash subscription config and proxy provider files
# Compares proxy node lists and generates detailed change reports

# extract_node_names <file>
# Extracts proxy node names from provider YAML (only proxies: section)
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

# detect_region <node_name>
# Detects region from Chinese keywords in node name
# Returns region_code, or empty if unknown
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

# check()
check() {
    local _state_file
    _state_file=$(ec_uci_get "monitor.openclash.state_file" "/tmp/eventcenter_state_openclash")
    local _first_run=0

    if [ ! -f "$_state_file" ]; then
        _first_run=1
        echo "First run: building baseline state" >&2
    fi

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

    # Discover provider files
    local _tmp_providers="/tmp/ec_providers_$$"
    : > "$_tmp_providers"

    local _cf _pf
    for _cf in $_config_files; do
        [ -z "$_cf" ] || [ ! -f "$_cf" ] && continue
        grep -A5 'proxy-providers:' "$_cf" 2>/dev/null | grep 'path:' | sed "s/.*path:[[:space:]]*//;s/['\"]//g;s/\.\///" | while read -r _p; do
            local _pp="/etc/openclash/$_p"
            [ -f "$_pp" ] && echo "$_pp"
        done >> "$_tmp_providers"
    done

    if [ -d "/etc/openclash/proxy_provider" ]; then
        for _pp in /etc/openclash/proxy_provider/*.yaml; do
            [ -f "$_pp" ] && grep -qxF "$_pp" "$_tmp_providers" 2>/dev/null || echo "$_pp"
        done >> "$_tmp_providers"
    fi

    # Build current node hash file: name<TAB>server:port per line
    local _tmp_current="/tmp/ec_current_$$"
    : > "$_tmp_current"

    sort -u "$_tmp_providers" | while IFS= read -r _pf; do
        [ -z "$_pf" ] || [ ! -f "$_pf" ] && continue
        awk '
            /^proxies:/ { in_p=1; next }
            /^(proxy-groups|rules):/ { in_p=0 }
            in_p && /name:/ {
                line=$0
                sub(/.*name:[[:space:]]*/, "", line)
                sub(/,.*/, "", line)
                gsub(/[\047"]/, "", line)
                name=line
                if (name ~ /(剩余|到期|套餐|距离|故障|充值|流量|重置|过期|expire|traffic|reset|servername)/ || name == "") next
                rest=$0
                sub(/.*type:/, "t:", rest); sub(/,.*/, "", rest)
                type=rest
                rest=$0
                sub(/.*server:/, "", rest); sub(/,.*/, "", rest)
                server=rest
                rest=$0
                sub(/.*port:/, "", rest); sub(/,.*/, "", rest)
                port=rest
                key = server ":" port
                if (key == ":") key = type
                print name "\t" key
            }
        ' "$_pf" 2>/dev/null >> "$_tmp_current"
    done

    local _current_total
    _current_total=$(wc -l < "$_tmp_current" 2>/dev/null || echo 0)

    # Load old state
    local _tmp_old="/tmp/ec_old_$$"
    : > "$_tmp_old"
    local _old_total=0

    if [ -f "$_state_file" ]; then
        grep "^nodehash:" "$_state_file" 2>/dev/null | sed 's/^nodehash://' > "$_tmp_old"
        _old_total=$(wc -l < "$_tmp_old" 2>/dev/null || echo 0)
    fi

    # Three-way diff using awk (stdout with prefixes, shell splits)
    local _tmp_diff="/tmp/ec_diff_$$"
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

    local _tmp_added="/tmp/ec_added_$$"
    local _tmp_removed="/tmp/ec_removed_$$"
    local _tmp_modified="/tmp/ec_modified_$$"

    grep "^A	" "$_tmp_diff" 2>/dev/null | cut -f2 > "$_tmp_added"
    grep "^R	" "$_tmp_diff" 2>/dev/null | cut -f2 > "$_tmp_removed"
    grep "^M	" "$_tmp_diff" 2>/dev/null | cut -f2 > "$_tmp_modified"

    local _added_count _removed_count _modified_count
    _added_count=$(wc -l < "$_tmp_added" 2>/dev/null || echo 0)
    _removed_count=$(wc -l < "$_tmp_removed" 2>/dev/null || echo 0)
    _modified_count=$(wc -l < "$_tmp_modified" 2>/dev/null || echo 0)

    if [ "$_added_count" -gt 0 ] 2>/dev/null || [ "$_removed_count" -gt 0 ] 2>/dev/null || [ "$_modified_count" -gt 0 ] 2>/dev/null; then
        if [ "$_first_run" -eq 0 ]; then
            # Build region changes
            local _tmp_regions="/tmp/ec_regions_$$"
            : > "$_tmp_regions"

            for _f in "$_tmp_added" "$_tmp_removed" "$_tmp_modified"; do
                [ -s "$_f" ] || continue
                _sign="+"
                [ "$_f" = "$_tmp_removed" ] && _sign="-"
                while IFS= read -r _name; do
                    [ -z "$_name" ] && continue
                    _r=$(detect_region "$_name")
                    [ -n "$_r" ] && echo "${_r} ${_sign}1"
                done < "$_f"
            done > "$_tmp_regions"
            # Build region lines with awk
            local _region_lines=""
            if [ -s "$_tmp_regions" ]; then
                _region_lines=$(awk '{
                    split($0, a, " "); r=a[1]; v=a[2]+0; sums[r]+=v
                } END {
                    for (r in sums) { v=sums[r]; if(v>0) printf "%s +%d\n",r,v; else if(v<0) printf "%s %d\n",r,v }
                }' "$_tmp_regions")
            fi

            # Detect new regions (in current but not in old) and gone regions
            local _tmp_old_regions="/tmp/ec_oldr_$$"
            local _tmp_new_regions="/tmp/ec_newr_$$"
            : > "$_tmp_old_regions"
            : > "$_tmp_new_regions"

            if [ -s "$_tmp_old" ]; then
                while IFS= read -r _name; do
                    [ -z "$_name" ] && continue
                    detect_region "$_name"
                done < "$_tmp_old" | sort -u > "$_tmp_old_regions"
            fi

            while IFS= read -r _line; do
                [ -z "$_line" ] && continue
                _name=$(echo "$_line" | cut -f1)
                detect_region "$_name"
            done < "$_tmp_current" | sort -u > "$_tmp_new_regions"

            local _new_regions_online=""
            if [ -s "$_tmp_new_regions" ]; then
                _new_regions_online=$(grep -vxFf "$_tmp_old_regions" "$_tmp_new_regions" 2>/dev/null)
            fi

            local _regions_gone=""
            if [ -s "$_tmp_old_regions" ]; then
                _regions_gone=$(grep -vxFf "$_tmp_new_regions" "$_tmp_old_regions" 2>/dev/null)
            fi

            # Build added/removed/modified name lists (max 5 each)
            local _added_list=""
            _added_list=$(head -5 "$_tmp_added" 2>/dev/null | awk '{printf "  + %s\n", $0}')
            local _removed_list=""
            _removed_list=$(head -5 "$_tmp_removed" 2>/dev/null | awk '{printf "  - %s\n", $0}')
            local _modified_list=""
            _modified_list=$(head -5 "$_tmp_modified" 2>/dev/null | awk '{printf "  ~ %s\n", $0}')

            # Build complete message with awk (avoids all subshell issues)
            local _ts _diff_str
            _ts=$(date '+%Y-%m-%d %H:%M:%S')
            _diff=$(( _current_total - _old_total ))
            if [ "$_diff" -ge 0 ] 2>/dev/null; then
                _diff_str="+${_diff}"
            else
                _diff_str="${_diff}"
            fi

            _msg=$(awk -v ts="$_ts" \
                -v old="$_old_total" -v new="$_current_total" -v diff="$_diff_str" \
                -v added="$_added_count" -v removed="$_removed_count" -v modified="$_modified_count" \
                -v regions="$_region_lines" \
                -v new_regions="$_new_regions_online" -v gone_regions="$_regions_gone" \
                -v added_list="$_added_list" -v removed_list="$_removed_list" -v modified_list="$_modified_list" \
                'BEGIN {
                    printf "🚀 *OpenClash Subscription Changed*\n\n"
                    printf "📅 %s\n\n", ts
                    printf "📦 *节点总数*\n%s → %s (%s)\n\n", old, new, diff
                    printf "📊 *变更统计*\n➕ 新增线路 %s\n➖ 下线线路 %s\n🔄 参数更新 %s", added, removed, modified

                    if (regions != "" || new_regions != "" || gone_regions != "") {
                        printf "\n\n🌎 *地区变化*"
                    }

                    if (new_regions != "") {
                        n = split(new_regions, nr, "\n")
                        for (i = 1; i <= n; i++) {
                            code = nr[i]; if (code == "") continue
                            emoji = ""
                            if (code=="HK") emoji="🇭🇰"
                            else if (code=="TW") emoji="🇨🇳"
                            else if (code=="JP") emoji="🇯🇵"
                            else if (code=="SG") emoji="🇸🇬"
                            else if (code=="US") emoji="🇺🇸"
                            else if (code=="KR") emoji="🇰🇷"
                            else if (code=="DE") emoji="🇩🇪"
                            else if (code=="FR") emoji="🇫🇷"
                            else if (code=="UK") emoji="🇬🇧"
                            else if (code=="NL") emoji="🇳🇱"
                            else if (code=="IN") emoji="🇮🇳"
                            else if (code=="CL") emoji="🇨🇱"
                            else if (code=="BR") emoji="🇧🇷"
                            else if (code=="ES") emoji="🇪🇸"
                            else if (code=="CH") emoji="🇨🇭"
                            else if (code=="SE") emoji="🇸🇪"
                            else if (code=="MX") emoji="🇲🇽"
                            else if (code=="CA") emoji="🇨🇦"
                            else if (code=="AU") emoji="🇦🇺"
                            else if (code=="RU") emoji="🇷🇺"
                            else if (code=="TR") emoji="🇹🇷"
                            else if (code=="AR") emoji="🇦🇷"
                            else if (code=="IT") emoji="🇮🇹"
                            else emoji=code
                            printf "\n🚀 %s %s 新地区上线", emoji, code
                        }
                    }

                    if (gone_regions != "") {
                        n = split(gone_regions, gr, "\n")
                        for (i = 1; i <= n; i++) {
                            code = gr[i]; if (code == "") continue
                            emoji = ""
                            if (code=="HK") emoji="🇭🇰"
                            else if (code=="TW") emoji="🇨🇳"
                            else if (code=="JP") emoji="🇯🇵"
                            else if (code=="SG") emoji="🇸🇬"
                            else if (code=="US") emoji="🇺🇸"
                            else if (code=="KR") emoji="🇰🇷"
                            else if (code=="DE") emoji="🇩🇪"
                            else if (code=="FR") emoji="🇫🇷"
                            else if (code=="UK") emoji="🇬🇧"
                            else if (code=="NL") emoji="🇳🇱"
                            else if (code=="IN") emoji="🇮🇳"
                            else if (code=="CL") emoji="🇨🇱"
                            else if (code=="BR") emoji="🇧🇷"
                            else if (code=="ES") emoji="🇪🇸"
                            else if (code=="CH") emoji="🇨🇭"
                            else if (code=="SE") emoji="🇸🇪"
                            else if (code=="MX") emoji="🇲🇽"
                            else if (code=="CA") emoji="🇨🇦"
                            else if (code=="AU") emoji="🇦🇺"
                            else if (code=="RU") emoji="🇷🇺"
                            else if (code=="TR") emoji="🇹🇷"
                            else if (code=="AR") emoji="🇦🇷"
                            else if (code=="IT") emoji="🇮🇹"
                            else emoji=code
                            printf "\n⚠️ %s %s 地区缩减", emoji, code
                        }
                    }

                    if (regions != "") {
                        n = split(regions, lines, "\n")
                        for (i = 1; i <= n; i++) {
                            split(lines[i], parts, " ")
                            code = parts[1]; delta = parts[2]
                            emoji = ""
                            if (code=="HK") emoji="🇭🇰"
                            else if (code=="TW") emoji="🇨🇳"
                            else if (code=="JP") emoji="🇯🇵"
                            else if (code=="SG") emoji="🇸🇬"
                            else if (code=="US") emoji="🇺🇸"
                            else if (code=="KR") emoji="🇰🇷"
                            else if (code=="DE") emoji="🇩🇪"
                            else if (code=="FR") emoji="🇫🇷"
                            else if (code=="UK") emoji="🇬🇧"
                            else if (code=="NL") emoji="🇳🇱"
                            else if (code=="IN") emoji="🇮🇳"
                            else if (code=="CL") emoji="🇨🇱"
                            else if (code=="BR") emoji="🇧🇷"
                            else if (code=="ES") emoji="🇪🇸"
                            else if (code=="CH") emoji="🇨🇭"
                            else if (code=="SE") emoji="🇸🇪"
                            else if (code=="MX") emoji="🇲🇽"
                            else if (code=="CA") emoji="🇨🇦"
                            else if (code=="AU") emoji="🇦🇺"
                            else if (code=="RU") emoji="🇷🇺"
                            else if (code=="TR") emoji="🇹🇷"
                            else if (code=="AR") emoji="🇦🇷"
                            else if (code=="IT") emoji="🇮🇹"
                            else emoji=code
                            printf "\n%s %s %s", emoji, code, delta
                        }
                    }

                    if (added_list != "" || removed_list != "" || modified_list != "") {
                        printf "\n\n📋 *主要变化*"
                        if (added_list != "") printf "\n%s", added_list
                        if (removed_list != "") printf "\n%s", removed_list
                        if (modified_list != "") printf "\n%s", modified_list
                    }
                }')

            eventcenter emit openclash config_change info \
                "订阅配置更新" \
                "$_msg"
        fi
    fi

    # Update state file
    local _tmp_state="${_state_file}.tmp"
    : > "$_tmp_state"

    awk -F'\t' '{printf "nodehash:%s\t%s\n", $1, $2}' "$_tmp_current" >> "$_tmp_state"

    mkdir -p "$(dirname "$_state_file")" 2>/dev/null
    mv "$_tmp_state" "$_state_file" 2>/dev/null

    # Cleanup
    rm -f "$_tmp_providers" "$_tmp_current" "$_tmp_old" "$_tmp_diff" "$_tmp_added" "$_tmp_removed" "$_tmp_modified" "$_tmp_regions" "$_tmp_old_regions" "$_tmp_new_regions"

    return 0
}
