#!/bin/sh
# Event Center - PushPlus Notifier (微信推送)
# /usr/bin/notifier_pushplus.sh "<message>"
# Sends notification via PushPlus (pushplus.plus)

. /usr/share/eventcenter/utils.sh

_token=$(uci -q get eventcenter.pushplus.token 2>/dev/null)
_topic=$(uci -q get eventcenter.pushplus.topic 2>/dev/null)
_template=$(uci -q get eventcenter.pushplus.template 2>/dev/null)

if [ -z "$_token" ]; then
    echo "Error: PushPlus token not configured" >&2
    exit 1
fi

_message="$1"
if [ -z "$_message" ]; then
    echo "Error: no message provided" >&2
    exit 1
fi

# Default template
[ -z "$_template" ] && _template="markdown"

# Extract title (first meaningful line)
_title=$(printf '%s' "$_message" | head -1 | sed 's/^[*📊🚀⚠️💚🟡📦📅🔧 ]*//;s/[*]*//g')
[ -z "$_title" ] && _title="Event Center 通知"

# Build JSON payload
_json=$(printf '%s' "$_message" | awk \
    -v token="$_token" \
    -v title="$_title" \
    -v topic="$_topic" \
    -v template="$_template" \
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
    if (topic != "") {
        printf "{\"token\":\"%s\",\"title\":\"%s\",\"content\":\"%s\",\"template\":\"%s\",\"topic\":\"%s\"}", token, title, buf, template, topic
    } else {
        printf "{\"token\":\"%s\",\"title\":\"%s\",\"content\":\"%s\",\"template\":\"%s\"}", token, title, buf, template
    }
}')

_url="http://www.pushplus.plus/send"

_response=$(curl -s -o /tmp/pushplus_response.json -w "%{http_code}" \
    --connect-timeout 10 \
    --max-time 10 \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$_json" \
    "$_url" 2>/dev/null)

_curl_exit=$?
rm -f /tmp/pushplus_response.json 2>/dev/null

if [ "$_curl_exit" -ne 0 ]; then
    echo "Error: curl failed with exit code $_curl_exit" >&2
    exit 1
fi

if [ "$_response" = "200" ]; then
    echo "OK: PushPlus notification sent"
    exit 0
else
    echo "Error: PushPlus API returned HTTP $_response" >&2
    exit 1
fi
