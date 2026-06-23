#!/bin/sh
# Event Center - Server酱 Turbo Notifier
# /usr/bin/notifier_serverchan.sh "<message>"
# Sends notification via ServerChan Turbo (sct.ftqq.com)
# API: https://sctapi.ftqq.com/<sendkey>.send

. /usr/share/eventcenter/utils.sh

_sendkey=$(uci -q get eventcenter.serverchan.sendkey 2>/dev/null)

if [ -z "$_sendkey" ]; then
    echo "Error: Server酱 SendKey not configured" >&2
    exit 1
fi

_message="$1"
if [ -z "$_message" ]; then
    echo "Error: no message provided" >&2
    exit 1
fi

# Extract title (first meaningful line, strip emoji/markdown)
_title=$(printf '%s' "$_message" | head -1 | sed 's/^[*📊🚀⚠️💚🟡📦📅🔧♻️🚤 ]*//;s/[*]*//g')
[ -z "$_title" ] && _title="Event Center 通知"

_url="https://sctapi.ftqq.com/${_sendkey}.send"

_response=$(curl -s -o /tmp/serverchan_response.json -w "%{http_code}" \
    --connect-timeout 10 \
    --max-time 10 \
    -X POST \
    -d "title=$(printf '%s' "$_title" | sed 's/ /%20/g')" \
    --data-urlencode "desp=${_message}" \
    "$_url" 2>/dev/null)

_curl_exit=$?

_code=0
if [ -f /tmp/serverchan_response.json ]; then
    _code=$(grep -o '"code":[0-9]*' /tmp/serverchan_response.json | grep -o '[0-9]*' | head -1)
fi
rm -f /tmp/serverchan_response.json 2>/dev/null

if [ "$_curl_exit" -ne 0 ]; then
    echo "Error: curl failed with exit code $_curl_exit" >&2
    exit 1
fi

if [ "$_response" = "200" ] && [ "$_code" = "0" ]; then
    echo "OK: Server酱 notification sent"
    exit 0
else
    echo "Error: Server酱 returned HTTP $_response code=$_code" >&2
    exit 1
fi
