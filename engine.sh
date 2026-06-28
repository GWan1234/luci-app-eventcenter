#!/bin/sh
# Event Center - Core Event Engine
# Reads UCI config, performs dedup, formats message, dispatches to notifiers

# Source utilities
. /usr/share/eventcenter/utils.sh

# engine_emit <source> <event> <level> <title> [message] [tags]
# Main event processing pipeline:
#   1. Check if eventcenter is enabled
#   2. Dedup check
#   3. Log the event
#   4. Format notification message
#   5. Dispatch to notifiers
engine_emit() {
    local _source="$1"
    local _event="$2"
    local _level="$3"
    local _title="$4"
    local _message="$5"
    local _tags="$6"

    # Validate required parameters
    if [ -z "$_source" ] || [ -z "$_event" ] || [ -z "$_level" ] || [ -z "$_title" ]; then
        echo "Error: missing required parameters" >&2
        echo "Usage: eventcenter emit <source> <event> <level> <title> [message]" >&2
        return 1
    fi

    # Default message to title if not provided
    if [ -z "$_message" ]; then
        _message="$_title"
    fi

    # 1. Check if enabled
    local _enable
    _enable=$(ec_uci_get "global.enable" "1")
    if [ "$_enable" != "1" ]; then
        echo "Event Center is disabled." >&2
        return 0
    fi

    # 2. Dedup check
    if ! dedup_check "$_source" "$_event"; then
        echo "Event skipped (duplicate within TTL): $_source:$_event" >&2
        return 0
    fi

    # 3. Log the event
    log_write "$_source" "$_event" "$_level" "$_title" "$_message"

    # 4. Format and send notification
    local _formatted
    _formatted=$(format_message "" "$_source" "$_event" "$_level" "$_title" "$_message")
    notify_send "$_formatted" "$_tags"

    echo "Event processed: $_source:$_event [$_level] $_title"
    return 0
}

# engine_test
# Sends a test notification to verify the pipeline
engine_test() {
    echo "Sending test event..."
    engine_emit "eventcenter" "test" "info" \
        "Event Center Test" \
        "This is a test notification from Event Center. If you see this, the pipeline is working."
}

# engine_check <source>
# Runs the check() function of a specific event source
engine_check() {
    local _source="$1"

    if [ -z "$_source" ]; then
        echo "Usage: eventcenter check <source>" >&2
        echo "Available sources:" >&2
        ls /usr/share/eventcenter/sources/*.sh 2>/dev/null | while read -r _f; do
            echo "  $(basename "$_f" .sh)" >&2
        done
        return 1
    fi

    local _source_script="/usr/share/eventcenter/sources/${_source}.sh"
    if [ ! -f "$_source_script" ]; then
        echo "Error: source script not found: $_source_script" >&2
        return 1
    fi

    # Source and run check()
    . "$_source_script"
    if type check >/dev/null 2>&1; then
        check
    else
        echo "Error: source '$_source' does not implement check()" >&2
        return 1
    fi
}

# engine_sources_list
# Lists all available event sources
engine_sources_list() {
    local _sources_dir="/usr/share/eventcenter/sources"

    if [ ! -d "$_sources_dir" ]; then
        echo "No sources directory found."
        return 0
    fi

    echo "=== Available Event Sources ==="
    local _found=0
    for _script in "$_sources_dir"/*.sh; do
        [ ! -f "$_script" ] && continue
        local _name
        _name=$(basename "$_script" .sh)
        # Check if script implements check()
        if grep -q '^check()' "$_script" 2>/dev/null; then
            printf '  %-20s [OK]\n' "$_name"
        else
            printf '  %-20s [no check()]\n' "$_name"
        fi
        _found=1
    done

    if [ "$_found" -eq 0 ]; then
        echo "  (no sources installed)"
    fi
}