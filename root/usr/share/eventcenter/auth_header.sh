#!/bin/sh
VAL=$(uci -q get openclash.config.dashboard_password 2>/dev/null)
[ -n "$VAL" ] && printf 'Authorization: Bearer *** %s\n' "$VAL"
