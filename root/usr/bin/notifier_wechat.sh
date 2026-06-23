#!/bin/sh
# Event Center - WeChat Work (企业微信) Notifier
# /usr/bin/notifier_wechat.sh "<message>"
# Sends notification via WeChat Work webhook

. /usr/share/eventcenter/utils.sh

_webhook=$(uci -q get eventcenter.wechat.webhook 2>/dev/null)
_mention=$(uci -q get eventcenter.wechat.mention 2>/dev/null)

if [ -z "$_webhook" ]; then
    echo "Error: WeChat webhook not configured" >&2
    exit 1
fi

_message="$1"
if [ -z "$_message" ]; then
    echo "Error: no message provided" >&2
    exit 1
fi

# Build JSON payload (markdown format)
_json=$(printf '%s' "$_message" | awk -v mention="$_mention" '
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
    if (mention != "") {
        printf "{\"msgtype\":\"markdown\",\"markdown\":{\"content\":\"%s\n<@%s>\"}}", buf, mention
    } else {
        printf "{\"msgtype\":\"markdown\",\"markdown\":{\"content\":\"%s\"}}", buf
    }
}')

_response=$(curl -s -o /tmp/wechat_response.json -w "%{http_code}" \
    --connect-timeout 10 \
    --max-time 10 \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$_json" \
    "$_webhook" 2>/dev/null)

_curl_exit=$?
rm -f /tmp/wechat_response.json 2>/dev/null

if [ "$_curl_exit" -ne 0 ]; then
    echo "Error: curl failed with exit code $_curl_exit" >&2
    exit 1
fi

if [ "$_response" = "200" ]; then
    echo "OK: WeChat notification sent"
    exit 0
else
    echo "Error: WeChat API returned HTTP $_response" >&2
    exit 1
fi
