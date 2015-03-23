#!/bin/bash

# this script should be called from /etc/sysconfig/network/ifcfg-em1
# by adding:
# ...
# POST_UP_SCRIPT=/etc/squid/squid_transparent_redirect.sh
# ...

# SQUID intercept port (usually 3129)
SQUID_PORT=3129

function ipofif() {
	/sbin/ifconfig $1 | grep "inet addr" | awk -F: '{print $2}' | awk '{print $1}'
}

iface=$2
ip=$(ipofif $iface)

logfile=/var/log/squid/squid_transparent_redirect.log

iptables -t nat -F
iptables -t nat -A PREROUTING -i $iface ! -d $ip -p tcp --dport 80 -j REDIRECT --to-ports $SQUID_PORT

now=$(date)
echo "$now - ----- Transparent HTTP Proxy redirection installed ------" >>$logfile
echo "$now - $0 called with arguments: $@" >> $logfile
echo "$now - Squid interception on: $iface ($ip) port $SQUID_PORT" >>$logfile
echo "$now - IPTables NAT dump:" >>$logfile
iptables -t nat -L -v | sed "s|^|$now - # |g" >>$logfile
