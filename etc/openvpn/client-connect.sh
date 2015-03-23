#!/bin/bash

# this script is started when a new client authenticates

OUTFILE=$1
VERBOSE=0

[ $verb -gt 2 ] && VERBOSE=1

# The following variables are defined by openvpn when calling us:

# common_name=dec12345
# config=/etc/openvpn/server.conf
# dev=tun0
# ifconfig_local=10.11.0.1
# ifconfig_pool_local_ip=10.11.0.5
# ifconfig_pool_remote_ip=10.11.0.6
# ifconfig_remote=10.11.0.2
# link_mtu=1542
# local_port=4987
# proto=udp
# route_gateway_1=10.11.0.2
# route_net_gateway=10.0.0.1
# route_netmask_1=255.255.0.0
# route_network_1=10.11.0.0
# route_vpn_gateway=10.11.0.2
# script_context=init
# script_type=client-connect
# tls_id_0=/C=FR/ST=NA/O=ScreenSoftware/O=3DCS/OU=DRI/CN=dec12345/emailAddress=contact@screensoftware.com
# tls_id_1=/C=FR/ST=NA/L=PARIS/O=ScreenSoftware/O=3DCS/OU=DRI/CN=troll/emailAddress=contact@screensoftware.com
# tls_serial_0=2
# tls_serial_1=-1
# trusted_ip=10.0.0.31
# trusted_port=32768
# tun_mtu=1500
# untrusted_ip=10.0.0.31
# untrusted_port=32768
# verb=4

# vpndomain=xxx.priv # set by setenv in server.conf
# vpndns=10.20.0.1 # set by setenv in server.conf

function info () {
	echo "$(date "+%Y%m%d %H:%M:%S") [$$] $@" >&2 
}

function verbose () {
	[ $VERBOSE -ne 0 ] && info "$@"
}

function error () {
	info "ERROR: $@"
}

function output () {
	echo "$@" >>$OUTFILE
	verbose "OUTPUT: $@"
}

function getip () {
	perl -e 'use Socket; use Net::hostent; $h=gethost($ARGV[0]); print inet_ntoa($h->addr);' $1
}

function getname() {
	perl -e 'use Socket; use Net::hostent; $h=gethost($ARGV[0]); print $h->name;' $1
}

info "client connect: cname=$common_name ip=$trusted_ip"
verbose "current dir: $(pwd)"
verbose "output to $OUTFILE"

# common output (generic, decoder)
host=$common_name.$vpndomain

# resolve host in standard client name (clientXXX.vpn.priv)
if [ $? -ne 0 ]; then
	error "$host is not resolved. Assuming generic client."
	exit 0
fi

# decoder identified: affect static address from common name
server=srv-$clt
serverip=$(getip $server)

if [ -z "$serverip" ]; then
	verbose "Unable to determine client '$common_name' server endpoint IP"
	server=server.$vpndomain
	serverip=$(getip $server)
fi
	
output "push \"setenv vpn_domain $vpndomain\""
output "push \"setenv vpn_dns $vpndns\""
output "push \"setenv vpn_server $serverip\""

# for resolvconf on client side
output "push \"dhcp-option DNS $vpndns\""
output "push \"dhcp-option DOMAIN $vpndomain\""

# if generic connexion, let openvpn take an address from pool
if [ "$common_name" == "generic" ]; then
	verbose "generic connexion: use dynamic address pool"
	exit 0
fi

info "push ip addresses: client=$host server=$server"
output "ifconfig-push $host $server"

exit 0

