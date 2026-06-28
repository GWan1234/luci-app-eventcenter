#!/bin/sh
# Event Center - Ntfy Notifier
# Sends notifications via ntfy server (behind reverse proxy)

. /usr/share/eventcenter/utils.sh

_message="$1"
_engine_tags="$2"
_title="$3"
[ -z "$_message" ] && exit 0

_url=$(ec_uci_get "ntfy.url" "")
_topic=$(ec_uci_get "ntfy.topic" "Openwrt")
_user=$(ec_uci_get "ntfy.user" "")
_pass=$(ec_uci_get "ntfy.pass" "")
_priority=$(ec_uci_get "ntfy.priority" "default")
_host=$(ec_uci_get "ntfy.host" "ntfy.flypigs.net")

[ -z "$_url" ] && exit 0

# Build tags
_tags=$(uci -q get eventcenter.ntfy.tags 2>/dev/null)
if [ -z "$_tags" ] && [ -n "$_engine_tags" ]; then
    _tags="$_engine_tags"
fi

# Build auth arg
_auth_arg=""
if [ -n "$_user" ] && [ -n "$_pass" ]; then
    _auth_arg="-u ${_user}:${_pass}"
fi

# Build tags header
_tags_arg=""
if [ -n "$_tags" ]; then
    _tags_arg="-H"
    _tags_val="Tags: ${_tags}"
fi

# Send - use direct curl call, not variable expansion
if [ -n "$_auth_arg" ] && [ -n "$_tags_arg" ]; then
    _result=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
        -u "${_user}:${_pass}" \
        -H "Host: ${_host}" \
        -H "Title: ${_title:-EventCenter}" \
        -H "Priority: ${_priority}" \
        -H "Tags: ${_tags}" \
        -d "$_message" \
        "${_url}/${_topic}" 2>/dev/null)
elif [ -n "$_auth_arg" ]; then
    _result=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
        -u "${_user}:${_pass}" \
        -H "Host: ${_host}" \
        -H "Title: ${_title:-EventCenter}" \
        -H "Priority: ${_priority}" \
        -d "$_message" \
        "${_url}/${_topic}" 2>/dev/null)
else
    _result=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
        -H "Host: ${_host}" \
        -H "Title: ${_title:-EventCenter}" \
        -H "Priority: ${_priority}" \
        -d "$_message" \
        "${_url}/${_topic}" 2>/dev/null)
fi

logger -t eventcenter-ntfy "sent to ${_url}/${_topic}: HTTP ${_result}"
exit 0
