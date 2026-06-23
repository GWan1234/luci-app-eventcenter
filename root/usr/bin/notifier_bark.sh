#!/bin/sh
# Event Center - Bark Notifier (iOS Push)
# /usr/bin/notifier_bark.sh "<message>"
# Sends notification via Bark push service

. /usr/share/eventcenter/utils.sh

_server=$(uci -q get eventcenter.bark.server 2>/dev/null)
_device_key=$(uci -q get eventcenter.bark.device_key 2>/dev/null)
_sound=$(uci -q get eventcenter.bark.sound 2>/dev/null)
_group=$(uci -q get eventcenter.bark.group 2>/dev/null)

if [ -z "$_server" ] || [ -z "$_device_key" ]; then
    echo "Error: Bark server or device_key not configured" >&2
    exit 1
fi

_message="$1"
if [ -z "$_message" ]; then
    echo "Error: no message provided" >&2
    exit 1
fi

# Remove trailing slash from server URL
_server=$(echo "$_server" | sed 's:/$::')

# Extract title (first line) and body (rest)
_title=$(printf '%s' "$_message" | head -1 | sed 's/^[*📊🚀⚠️💚🟡📦📅🔧 ]*//;s/[*]*//g')
_body="$_message"

# Build JSON payload
_json=$(printf '%s' "$_body" | awk \
    -v title="$_title" \
    -v device_key="$_device_key" \
    -v sound="${_sound:-minuet}" \
    -v group="${_group:-EventCenter}" \
    '
BEGIN { ORS="" }
{
    if (NR > 1) buf = buf "\n";
    buf = buf $0
}
END {
    gsub(/\\/, "\\\\", buf);
    gsub(/"/, "\\\"", buf);
    gsub(/\n/, "\\n", buf);
    gsub(/\r/, "\\r", buf);
    gsub(/\t/, "\\t", buf);
    gsub(/\\/, "\\\\", title);
    gsub(/"/, "\\\"", title);
    gsub(/\n/, "\\n", title);
    printf "{\"device_key\":\"%s\",\"title\":\"%s\",\"body\":\"%s\",\"sound\":\"%s\",\"group\":\"%s\"}", device_key, title, buf, sound, group
}')

_url="${_server}/push"

_response=$(curl -s -o /tmp/bark_response.json -w "%{http_code}" \
    --connect-timeout 10 \
    --max-time 10 \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$_json" \
    "$_url" 2>/dev/null)

_curl_exit=$?
rm -f /tmp/bark_response.json 2>/dev/null

if [ "$_curl_exit" -ne 0 ]; then
    echo "Error: curl failed with exit code $_curl_exit" >&2
    exit 1
fi

if [ "$_response" = "200" ]; then
    echo "OK: Bark notification sent"
    exit 0
else
    echo "Error: Bark API returned HTTP $_response" >&2
    exit 1
fi
