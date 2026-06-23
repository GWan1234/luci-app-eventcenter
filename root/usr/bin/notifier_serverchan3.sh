#!/bin/sh
# Event Center - Server酱³ Notifier (手机APP推送)
# /usr/bin/notifier_serverchan3.sh "<message>"
# Sends notification via Server酱³ (doc.sc3.ft07.com)
# API: https://<uid>.push.ft07.com/send/<sendkey>.send

. /usr/share/eventcenter/utils.sh

_sendkey=$(uci -q get eventcenter.serverchan3.sendkey 2>/dev/null)
_uid=$(uci -q get eventcenter.serverchan3.uid 2>/dev/null)

if [ -z "$_sendkey" ]; then
    echo "Error: Server酱³ SendKey not configured" >&2
    exit 1
fi

_message="$1"
if [ -z "$_message" ]; then
    echo "Error: no message provided" >&2
    exit 1
fi

# Extract title
_title=$(printf '%s' "$_message" | head -1 | sed 's/^[*📊🚀⚠️💚🟡📦📅🔧♻️🚤 ]*//;s/[*]*//g')
[ -z "$_title" ] && _title="Event Center 通知"

# Auto-extract uid from sendkey if not configured: sctp<uid>t... or SCT<uid>T...
if [ -z "$_uid" ]; then
    _uid=$(printf '%s' "$_sendkey" | sed -n 's/^[Ss][Cc][Tt][Pp]*\([0-9]*\)[Tt].*/\1/p')
fi

if [ -z "$_uid" ]; then
    echo "Error: uid not found. Set uid in config or use sendkey format sctp<uid>t..." >&2
    exit 1
fi

_url="https://${_uid}.push.ft07.com/send/${_sendkey}.send"

_response=$(curl -s -o /tmp/serverchan3_response.json -w "%{http_code}" \
    --connect-timeout 10 \
    --max-time 10 \
    -X POST \
    -d "title=$(printf '%s' "$_title" | sed 's/ /%20/g')" \
    --data-urlencode "desp=${_message}" \
    "$_url" 2>/dev/null)

_curl_exit=$?

_code=0
if [ -f /tmp/serverchan3_response.json ]; then
    _code=$(grep -o '"code":[0-9]*' /tmp/serverchan3_response.json | grep -o '[0-9]*' | head -1)
fi
rm -f /tmp/serverchan3_response.json 2>/dev/null

if [ "$_curl_exit" -ne 0 ]; then
    echo "Error: curl failed with exit code $_curl_exit" >&2
    exit 1
fi

if [ "$_response" = "200" ] && [ "$_code" = "0" ]; then
    echo "OK: Server酱³ notification sent"
    exit 0
else
    echo "Error: Server酱³ returned HTTP $_response code=$_code" >&2
    exit 1
fi
