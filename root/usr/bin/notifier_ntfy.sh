#!/bin/sh
# Event Center - ntfy Notifier (自建推送服务)
# /usr/bin/notifier_ntfy.sh "<message>"
# Sends notification via ntfy (self-hosted)
# API: POST http://server/topic

. /usr/share/eventcenter/utils.sh

_url=$(uci -q get eventcenter.ntfy.url 2>/dev/null)
_topic=$(uci -q get eventcenter.ntfy.topic 2>/dev/null)
_token=$(uci -q get eventcenter.ntfy.token 2>/dev/null)
_user=$(uci -q get eventcenter.ntfy.user 2>/dev/null)
_pass=$(uci -q get eventcenter.ntfy.pass 2>/dev/null)

if [ -z "$_url" ] || [ -z "$_topic" ]; then
    echo "Error: ntfy url or topic not configured" >&2
    exit 1
fi

_message="$1"
if [ -z "$_message" ]; then
    echo "Error: no message provided" >&2
    exit 1
fi

# Extract title
_title=$(printf '%s' "$_message" | head -1 | sed 's/^[*📊🚀⚠️💚🟡📦📅🔧♻️🚤 ]*//;s/[*]*//g')
[ -z "$_title" ] && _title="Event Center"

# Remove trailing slash from URL
_url=$(echo "$_url" | sed 's:/$::')

# Build curl command
_curl_cmd="curl -s -o /tmp/ntfy_response.json -w '%{http_code}' --connect-timeout 10 --max-time 10 -X POST"
_curl_cmd="$_curl_cmd -H 'Title: $_title'"
_curl_cmd="$_curl_cmd -H 'Priority: default'"

# Auth
if [ -n "$_token" ]; then
    _curl_cmd="$_curl_cmd -H 'Authorization: Bearer $_token'"
elif [ -n "$_user" ] && [ -n "$_pass" ]; then
    _curl_cmd="$_curl_cmd -u '$_user:$_pass'"
fi

_curl_cmd="$_curl_cmd -d '$(printf '%s' "$_message")'"
_curl_cmd="$_curl_cmd '${_url}/${_topic}'"

_response=$(eval "$_curl_cmd" 2>/dev/null)
_curl_exit=$?
rm -f /tmp/ntfy_response.json 2>/dev/null

if [ "$_curl_exit" -ne 0 ]; then
    echo "Error: curl failed with exit code $_curl_exit" >&2
    exit 1
fi

if [ "$_response" = "200" ]; then
    echo "OK: ntfy notification sent"
    exit 0
else
    echo "Error: ntfy returned HTTP $_response" >&2
    exit 1
fi
