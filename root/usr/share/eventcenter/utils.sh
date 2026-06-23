#!/bin/sh
# Event Center - Utility Functions
# Provides logging, dedup, and message formatting

# --- UCI helpers ---

# ec_uci_get <option> [default]
# Reads a UCI option from eventcenter config with fallback default
ec_uci_get() {
    local _opt="$1"
    local _default="$2"
    local _val
    _val=$(uci -q get "eventcenter.${_opt}" 2>/dev/null)
    if [ -n "$_val" ]; then
        printf '%s' "$_val"
    else
        printf '%s' "$_default"
    fi
}

# ec_uci_get_section <section_type> <section_name> <option> [default]
ec_uci_get_section() {
    local _type="$1"
    local _name="$2"
    local _opt="$3"
    local _default="$4"
    local _val
    _val=$(uci -q get "eventcenter.@${_type}[0].${_opt}" 2>/dev/null)
    if [ -z "$_val" ] && [ -n "$_name" ]; then
        _val=$(uci -q get "eventcenter.${_name}.${_opt}" 2>/dev/null)
    fi
    if [ -n "$_val" ]; then
        printf '%s' "$_val"
    else
        printf '%s' "$_default"
    fi
}

# --- Logging ---

# log_write <source> <event> <level> <title> <message>
# Appends a line to the log file, truncates if over max lines
log_write() {
    local _source="$1"
    local _event="$2"
    local _level="$3"
    local _title="$4"
    local _message="$5"

    local _log_path
    _log_path=$(ec_uci_get "global.log_path" "/tmp/eventcenter.log")
    local _max_lines
    _max_lines=$(ec_uci_get "global.log_max_lines" "1000")

    local _ts
    _ts=$(date '+%Y-%m-%d %H:%M:%S')

    # Ensure log directory exists
    local _dir
    _dir=$(dirname "$_log_path")
    mkdir -p "$_dir" 2>/dev/null

    # Append log entry
    printf '%s|%s|%s|%s|%s|%s\n' "$_ts" "$_source" "$_event" "$_level" "$_title" "$_message" >> "$_log_path"

    # Truncate if over max lines (keep newest N lines)
    local _line_count
    _line_count=$(wc -l < "$_log_path" 2>/dev/null || echo 0)
    if [ "$_line_count" -gt "$_max_lines" ] 2>/dev/null; then
        local _tmp="${_log_path}.trunc"
        tail -n "$_max_lines" "$_log_path" > "$_tmp" 2>/dev/null
        mv "$_tmp" "$_log_path" 2>/dev/null
    fi
}

# --- Dedup ---

# dedup_check <source> <event>
# Returns 0 if this event should proceed (NOT a duplicate)
# Returns 1 if it IS a duplicate within TTL
dedup_check() {
    local _source="$1"
    local _event="$2"

    local _dedup_path
    _dedup_path=$(ec_uci_get "global.dedup_path" "/tmp/eventcenter_dedup")
    local _ttl
    _ttl=$(ec_uci_get "global.dedup_ttl" "300")
    local _max_entries
    _max_entries=$(ec_uci_get "global.dedup_max" "500")

    # Compute dedup key as md5 of "source:event"
    local _key
    _key=$(printf '%s:%s' "$_source" "$_event" | md5sum 2>/dev/null | cut -d' ' -f1)
    if [ -z "$_key" ]; then
        # md5sum not available, allow the event
        return 0
    fi

    local _now
    _now=$(date '+%s')

    # Ensure dedup file exists
    mkdir -p "$(dirname "$_dedup_path")" 2>/dev/null
    touch "$_dedup_path" 2>/dev/null

    # Check if key exists and is within TTL
    local _entry
    _entry=$(grep "^${_key}|" "$_dedup_path" 2>/dev/null | head -1)
    if [ -n "$_entry" ]; then
        local _ts
        _ts=$(echo "$_entry" | cut -d'|' -f2)
        local _age
        _age=$(( _now - _ts ))
        if [ "$_age" -lt "$_ttl" ] 2>/dev/null && [ "$_age" -ge 0 ] 2>/dev/null; then
            return 1  # duplicate, skip
        fi
    fi

    # Not a duplicate: add/update entry
    # Remove old entry for this key first
    if [ -f "$_dedup_path" ]; then
        local _tmp="${_dedup_path}.tmp"
        grep -v "^${_key}|" "$_dedup_path" > "$_tmp" 2>/dev/null
        mv "$_tmp" "$_dedup_path" 2>/dev/null
    fi
    printf '%s|%s\n' "$_key" "$_now" >> "$_dedup_path"

    # Auto-clean if over max entries
    local _entry_count
    _entry_count=$(wc -l < "$_dedup_path" 2>/dev/null || echo 0)
    if [ "$_entry_count" -gt "$_max_entries" ] 2>/dev/null; then
        local _tmp="${_dedup_path}.clean"
        tail -n "$_max_entries" "$_dedup_path" > "$_tmp" 2>/dev/null
        mv "$_tmp" "$_dedup_path" 2>/dev/null
    fi

    return 0  # not a duplicate
}

# dedup_clear
# Clears the entire dedup cache
dedup_clear() {
    local _dedup_path
    _dedup_path=$(ec_uci_get "global.dedup_path" "/tmp/eventcenter_dedup")
    : > "$_dedup_path" 2>/dev/null
}

# --- Message Formatting ---

# format_message <template> <source> <event> <level> <title> <message>
# Formats a notification message. Supports %SOURCE%, %EVENT%, %LEVEL%, %TITLE%, %MESSAGE%, %TIME%
# If message is pre-formatted (contains structured report), use it as-is
format_message() {
    local _template="$1"
    local _source="$2"
    local _event="$3"
    local _level="$4"
    local _title="$5"
    local _message="$6"

    # If message is pre-formatted (contains 🚀 or 📊), use as-is
    case "$_message" in
        *🚀*|*📊*)
            printf '%s' "$_message"
            return 0
            ;;
    esac

    local _time
    _time=$(date '+%Y-%m-%d %H:%M:%S')

    if [ -z "$_template" ]; then
        _template="*%TITLE%*

%MESSAGE%"
    fi

    # Use awk for safe substitution
    printf '%s' "$_template" | awk \
        -v src="$_source" -v evt="$_event" -v lvl="$_level" \
        -v ttl="$_title" -v msg="$_message" -v tme="$_time" \
        '{
            gsub(/%SOURCE%/, src);
            gsub(/%EVENT%/, evt);
            gsub(/%LEVEL%/, lvl);
            gsub(/%TITLE%/, ttl);
            gsub(/%MESSAGE%/, msg);
            gsub(/%TIME%/, tme);
            print
        }'
}

# --- Notifier dispatch ---

# notify_send <message>
# Dispatches message to all enabled notifiers
notify_send() {
    local _message="$1"

    # Find all notifier sections from UCI config
    # uci show output format: eventcenter.telegram=notifier
    local _lines
    _lines=$(uci -q show eventcenter 2>/dev/null | grep '=notifier')
    local _i=0
    echo "$_lines" | while IFS= read -r _line; do
        [ -z "$_line" ] && continue

        # Extract section name: eventcenter.telegram=notifier -> telegram
        local _section
        _section=$(echo "$_line" | cut -d'.' -f2 | cut -d'=' -f1)

        local _enable
        _enable=$(uci -q get "eventcenter.${_section}.enable" 2>/dev/null)

        if [ "$_enable" = "1" ]; then
            # Dispatch to notifier script
            local _notifier_script="/usr/bin/notifier_${_section}.sh"
            if [ -x "$_notifier_script" ]; then
                "$_notifier_script" "$_message"
            fi
        fi
        _i=$(( _i + 1 ))
    done
}

# --- Log reading ---

# log_read [limit]
# Reads the log file and outputs entries
log_read() {
    local _limit="$1"
    local _log_path
    _log_path=$(ec_uci_get "global.log_path" "/tmp/eventcenter.log")

    if [ ! -f "$_log_path" ]; then
        echo "No log entries found."
        return 0
    fi

    if [ -n "$_limit" ] && [ "$_limit" -gt 0 ] 2>/dev/null; then
        tail -n "$_limit" "$_log_path"
    else
        cat "$_log_path"
    fi
}

# --- Service status ---

# service_status
# Prints the current Event Center status
service_status() {
    local _enable
    _enable=$(ec_uci_get "global.enable" "1")
    local _log_path
    _log_path=$(ec_uci_get "global.log_path" "/tmp/eventcenter.log")
    local _dedup_path
    _dedup_path=$(ec_uci_get "global.dedup_path" "/tmp/eventcenter_dedup")

    echo "=== Event Center Status ==="
    echo "Enabled:      $([ "$_enable" = "1" ] && echo "Yes" || echo "No")"

    # Log info
    if [ -f "$_log_path" ]; then
        local _lines
        _lines=$(wc -l < "$_log_path" 2>/dev/null || echo 0)
        local _last
        _last=$(tail -1 "$_log_path" 2>/dev/null | cut -d'|' -f1)
        echo "Log:          $_log_path ($_lines entries)"
        echo "Last event:   ${_last:-N/A}"
    else
        echo "Log:          $_log_path (empty)"
    fi

    # Dedup info
    if [ -f "$_dedup_path" ]; then
        local _dedup_count
        _dedup_count=$(wc -l < "$_dedup_path" 2>/dev/null || echo 0)
        local _ttl
        _ttl=$(ec_uci_get "global.dedup_ttl" "300")
        echo "Dedup cache:  $_dedup_path ($_dedup_count entries, TTL ${_ttl}s)"
    else
        echo "Dedup cache:  (empty)"
    fi

    # Notifiers
    echo ""
    echo "--- Notifiers ---"
    local _count
    _count=$(uci -q show eventcenter 2>/dev/null | grep '=notifier' | wc -l)
    local _i=0
    while [ "$_i" -lt "$_count" ] 2>/dev/null; do
        local _n_enable
        _n_enable=$(uci -q get "eventcenter.@notifier[${_i}].enable" 2>/dev/null || echo "0")
        local _n_type
        _n_type=$(uci -q get "eventcenter.@notifier[${_i}]" 2>/dev/null | cut -d'=' -f1 | sed 's/eventcenter\.//')
        local _n_name
        _n_name=$(uci -q get "eventcenter.@notifier[${_i}]" 2>/dev/null | cut -d'.' -f2 | cut -d'=' -f1)
        printf '  %-12s enabled=%s\n' "${_n_name:-notifier}" "$_n_enable"
        _i=$(( _i + 1 ))
    done
    [ "$_count" -eq 0 ] 2>/dev/null && echo "  (none configured)"

    # Monitors
    echo ""
    echo "--- Monitors ---"
    local _m_count
    _m_count=$(uci -q show eventcenter 2>/dev/null | grep '=monitor' | wc -l)
    local _j=0
    while [ "$_j" -lt "$_m_count" ] 2>/dev/null; do
        local _m_enable
        _m_enable=$(uci -q get "eventcenter.@monitor[${_j}].enable" 2>/dev/null || echo "0")
        local _m_name
        _m_name=$(uci -q get "eventcenter.@monitor[${_j}]" 2>/dev/null | cut -d'.' -f2 | cut -d'=' -f1)
        printf '  %-12s enabled=%s\n' "${_m_name:-monitor}" "$_m_enable"
        _j=$(( _j + 1 ))
    done
    [ "$_m_count" -eq 0 ] 2>/dev/null && echo "  (none configured)"
}
