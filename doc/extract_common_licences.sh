#!/bin/bash 

SNAPSHOT=http://download.tizen.org/snapshots/tizen/common/latest
REPOSITORIES="x86_64-wayland arm-wayland x86_64-x11 arm-x11"

XMLSTARLET=$(which xml || which xmlstarlet)
[[ -z "$XMLSTARLET" ]] && { echo "Please install xmlstarlet" >&2; exit 1; }

#tmpfile=$(mktemp /tmp/primarydb.XXXXXX)
#trap "rm -f $tmpfile" STOP INT QUIT EXIT
tmpfile=/tmp/foo.db

function list_repo_licenses() {
	url=$1

	# get the name for sqlite db
	dburl=$url/$(curl --silent $url/repodata/repomd.xml | xml sel -t -v "/_:repomd/_:data/_:location/@href" | grep primary.sqlite.bz2)


	echo "Fetching $dburl" >&2
	curl --silent $dburl | bzip2 -d -c >${tmpfile} || { echo "Invalid bz2 db file" >&2; return 1; }

	sqlite3 -separator ';' $tmpfile "select name,rpm_license from packages"
}


for repo in $REPOSITORIES; do
	list_repo_licenses $SNAPSHOT/repos/$repo/source
done | sort -u
