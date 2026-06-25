#!/bin/sh
# Event Center - System Health Event Source
# Monitors CPU, memory, temperature, and disk usage
# Sends alerts when thresholds are exceeded
# Compatible with busybox ash

# Source utilities (for standalone execution via fs.exec)
. /usr/share/eventcenter/utils.sh

STATE_FILE="/tmp/eventcenter_sys_health"

# --- CPU usage (1-second sample) ---

get_cpu_usage() {
    # Read initial stats
    local _cpu1_idle _cpu1_total
    _cpu1_idle=$(awk '/^cpu / {print $5}' /proc/stat)
    _cpu1_total=$(awk '/^cpu / {total=0; for(i=2;i<=NF;i++) total+=$i; print total}' /proc/stat)

    sleep 1

    # Read stats again
    local _cpu2_idle _cpu2_total
    _cpu2_idle=$(awk '/^cpu / {print $5}' /proc/stat)
    _cpu2_total=$(awk '/^cpu / {total=0; for(i=2;i<=NF;i++) total+=$i; print total}' /proc/stat)

    local _diff_idle _diff_total _usage
    _diff_idle=$(( _cpu2_idle - _cpu1_idle ))
    _diff_total=$(( _cpu2_total - _cpu1_total ))

    if [ "$_diff_total" -gt 0 ]; then
        _usage=$(( 100 * (_diff_total - _diff_idle) / _diff_total ))
        echo "$_usage"
    else
        echo "0"
    fi
}

# --- Memory usage ---

get_mem_usage() {
    awk '
    /^MemTotal:/ { total=$2 }
    /^MemAvailable:/ { avail=$2 }
    END {
        if (total > 0)
            printf "%d", 100 * (total - avail) / total
        else
            print 0
    }
    ' /proc/meminfo
}

get_mem_info() {
    awk '
    /^MemTotal:/ { total=$2 }
    /^MemAvailable:/ { avail=$2 }
    END {
        used = total - avail
        printf "%d %d %d", total/1024, used/1024, avail/1024
    }
    ' /proc/meminfo
}

# --- Temperature ---

get_temperature() {
    # Try thermal zones first
    local _temp=""
    for _zone in /sys/class/thermal/thermal_zone*/temp; do
        [ -f "$_zone" ] || continue
        _temp=$(cat "$_zone" 2>/dev/null)
        if [ -n "$_temp" ] && [ "$_temp" -gt 0 ] 2>/dev/null; then
            # Convert millidegrees to degrees
            echo $(( _temp / 1000 ))
            return
        fi
    done

    # Try hwmon
    for _hwmon in /sys/class/hwmon/hwmon*/temp1_input; do
        [ -f "$_hwmon" ] || continue
        _temp=$(cat "$_hwmon" 2>/dev/null)
        if [ -n "$_temp" ] && [ "$_temp" -gt 0 ] 2>/dev/null; then
            echo $(( _temp / 1000 ))
            return
        fi
    done

    echo ""
}

# --- Disk usage ---

get_disk_usage() {
    # Returns usage% and path for each mounted filesystem (excluding tmpfs/dev)
    df -h 2>/dev/null | awk '
    NR > 1 && !/^(tmpfs|devtmpfs|overlay)/ && !/\/dev\/loop/ {
        gsub(/%/, "", $5)
        if ($5+0 > 0)
            printf "%s\t%s\t%s\t%s\n", $5, $6, $3, $2
    }'
}

# --- Load average ---

get_load_avg() {
    awk '{printf "%s %s %s", $1, $2, $3}' /proc/loadavg 2>/dev/null
}

# --- Main check ---

check() {
    local _enable
    _enable=$(ec_uci_get "system_health.enable" "0")
    [ "$_enable" != "1" ] && return 0

    # Read thresholds (pre-set defaults for most users)
    local _cpu_thresh _mem_thresh _disk_thresh _temp_thresh
    _cpu_thresh=$(ec_uci_get "system_health.cpu_threshold" "80")
    _mem_thresh=$(ec_uci_get "system_health.mem_threshold" "85")
    _disk_thresh=$(ec_uci_get "system_health.disk_threshold" "90")
    _temp_thresh=$(ec_uci_get "system_health.temp_threshold" "75")

    # Load previous state
    local _prev_state=""
    [ -f "$STATE_FILE" ] && _prev_state=$(cat "$STATE_FILE")

    # Collect current metrics
    local _cpu _mem _temp _load _mem_info
    _cpu=$(get_cpu_usage)
    _mem=$(get_mem_usage)
    _temp=$(get_temperature)
    _load=$(get_load_avg)
    _mem_info=$(get_mem_info)

    # Parse mem_info (space-separated: total used avail)
    local _mem_total _mem_used _mem_avail
    _mem_total=$(echo "$_mem_info" | cut -d' ' -f1)
    _mem_used=$(echo "$_mem_info" | cut -d' ' -f2)
    _mem_avail=$(echo "$_mem_info" | cut -d' ' -f3)

    # Build alert list
    local _alerts=""
    local _level="info"

    # CPU check
    if [ "$_cpu" -ge "$_cpu_thresh" ] 2>/dev/null; then
        _alerts="${_alerts}🖥️ CPU: ${_cpu}% (阈值 ${_cpu_thresh}%)\n"
        _level="warn"
    fi

    # Memory check
    if [ "$_mem" -ge "$_mem_thresh" ] 2>/dev/null; then
        _alerts="${_alerts}💾 内存: ${_mem}% (${_mem_used}MB/${_mem_total}MB)\n"
        _level="warn"
    fi

    # Temperature check (skip if empty)
    if [ -n "$_temp" ] && [ "$_temp" -ge "$_temp_thresh" ] 2>/dev/null; then
        _alerts="${_alerts}🌡️ 温度: ${_temp}°C (阈值 ${_temp_thresh}°C)\n"
        _level="warn"
    fi

    # Disk check
    get_disk_usage | while IFS='	' read -r _dusage _dpath _dused _dsize; do
        [ -z "$_dusage" ] && continue
        if [ "$_dusage" -ge "$_disk_thresh" ] 2>/dev/null; then
            _alerts="${_alerts}💿 磁盘 ${_dpath}: ${_dusage}% (${_dused}/${_dsize})\n"
            _level="warn"
        fi
    done

    # Save current state (metrics summary)
    printf 'cpu=%s mem=%s temp=%s load=%s\n' "$_cpu" "$_mem" "$_temp" "$_load" > "${STATE_FILE}.tmp"
    mv "${STATE_FILE}.tmp" "$STATE_FILE"

    # If no alerts, check if we need to send recovery
    if [ -z "$_alerts" ]; then
        # If previous state had alerts, send recovery notification
        if echo "$_prev_state" | grep -q "alert=1"; then
            local _recovery
            _recovery=$(printf "✅ *系统恢复正常*\n\n")
            _recovery=$(printf "%s🖥️ CPU: %s%%\n" "$_recovery" "$_cpu")
            _recovery=$(printf "%s💾 内存: %s%% (%sMB/%sMB)\n" "$_recovery" "$_mem" "$_mem_used" "$_mem_total")
            [ -n "$_temp" ] && _recovery=$(printf "%s🌡️ 温度: %s°C\n" "$_recovery" "$_temp")
            _recovery=$(printf "%s📊 负载: %s\n" "$_recovery" "$_load")

            eventcenter emit system "health_recovery" info \
                "系统恢复正常" \
                "$_recovery"
        fi
        return 0
    fi

    # Has alerts - mark state and send notification
    echo "alert=1" >> "$STATE_FILE"

    # Build notification message
    local _msg
    _msg=$(printf "⚠️ *系统健康告警*\n\n")
    _msg=$(printf "%s%s" "$_msg" "$_alerts")
    _msg=$(printf "%s\n📊 负载: %s\n" "$_msg" "$_load")
    _msg=$(printf "%s💾 内存详情: %sMB / %sMB (可用 %sMB)" "$_msg" "$_mem_used" "$_mem_total" "$_mem_avail")

    eventcenter emit system "health_alert" "$_level" \
        "系统健康告警" \
        "$_msg"
}

# --- Status (for overview page) ---

status() {
    local _cpu _mem _temp _load _mem_info
    _cpu=$(get_cpu_usage)
    _mem=$(get_mem_usage)
    _temp=$(get_temperature)
    _load=$(get_load_avg)
    _mem_info=$(get_mem_info)

    # Parse mem_info
    local _mem_total _mem_used _mem_avail
    _mem_total=$(echo "$_mem_info" | cut -d' ' -f1)
    _mem_used=$(echo "$_mem_info" | cut -d' ' -f2)
    _mem_avail=$(echo "$_mem_info" | cut -d' ' -f3)

    echo "=== System Health Status ==="
    echo "CPU:        ${_cpu}%"
    echo "Memory:     ${_mem}% (${_mem_used}MB / ${_mem_total}MB, avail ${_mem_avail}MB)"
    [ -n "$_temp" ] && echo "Temperature: ${_temp}°C" || echo "Temperature: N/A"
    echo "Load Avg:   ${_load}"
    echo ""
    echo "--- Disk Usage ---"
    get_disk_usage | while IFS='	' read -r _dusage _dpath _dused _dsize; do
        printf "  %-20s %3s%% (%s / %s)\n" "$_dpath" "$_dusage" "$_dused" "$_dsize"
    done
}


# --- Main entry point ---
case "$1" in
    get)
        _cpu=$(get_cpu_usage)
        _mem=$(get_mem_usage)
        _temp=$(get_temperature)
        _disk=$(df / | awk 'NR==2{gsub(/%/,"",$5); print $5}')
        _uptime=$(uptime | sed 's/.*up \([^,]*\),.*/\1/' | xargs)
        echo "${_cpu}|${_mem}|${_temp:-0}|${_disk}|${_uptime}"
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
