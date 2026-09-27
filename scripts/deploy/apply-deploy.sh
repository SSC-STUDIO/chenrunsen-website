#!/bin/bash
# Apply the staged deploy to the web root and drop files the new build no
# longer contains.  Kept as a file rather than an inline ssh command because
# the Chinese paths and the arithmetic in it do not survive PowerShell quoting.
set -e

WEBROOT=/var/www/chenrunsen-site
STAGE=/tmp/deploy-stage
LIST=/tmp/delete-list.txt

echo "=== 1. copy changed files into the web root ==="
cd "$STAGE"
tar -cf - . | (cd "$WEBROOT" && tar -xf -)
echo "copied $(find . -type f | wc -l) files"

echo "=== 2. remove stale files ==="
cd "$WEBROOT"
# The list is written on Windows, so its lines end CRLF.  Without stripping the
# \r every path gets a trailing carriage return, `-f` fails on all of them, and
# the step silently reports "already absent" for files that are sitting right
# there.  That is exactly what happened on the first run.
tr -d '\r' < "$LIST" > "$LIST.clean"
removed=0
missing=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if [ -f "$f" ]; then
    rm -f "$f"
    removed=$((removed + 1))
  else
    missing=$((missing + 1))
  fi
done < "$LIST.clean"
echo "removed $removed, already absent $missing"

echo "=== 3. prune empty directories ==="
find . -type d -empty -delete 2>/dev/null || true

echo "=== 4. result ==="
echo "web root files: $(find . -type f | wc -l)"
echo "media files:    $(ls jay-town/media 2>/dev/null | wc -l)"
echo "jay-town build:"
ls _astro/ | grep -i 'jay-town' || true
