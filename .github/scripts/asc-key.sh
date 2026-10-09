#!/usr/bin/env bash
# Turn whatever was pasted into the ASC_KEY_P8 secret into a clean .p8 that
# xcodebuild accepts, or stop with a message that says what is wrong.
#
#   ASC_KEY_P8=... .github/scripts/asc-key.sh OUT.p8
#
# Handles Windows line endings (\r\n), literal "\n" escapes, surrounding
# quotes, missing or mangled BEGIN/END lines, the key squashed onto one line,
# and the whole .p8 file base64-encoded once more. The result is re-written by
# openssl as PKCS#8 PEM with Unix line endings and checked to be an EC P-256
# key, which is what every App Store Connect API key is. Nothing secret is
# printed.
set -euo pipefail

out="${1:?usage: asc-key.sh OUT.p8}"
fail() { echo "::error title=ASC_KEY_P8::$*"; exit 1; }

# macOS's own openssl is LibreSSL; use Homebrew's OpenSSL 3 when it is there
openssl() {
  local c
  for c in /opt/homebrew/opt/openssl@3/bin/openssl /usr/local/opt/openssl@3/bin/openssl; do
    if [ -x "$c" ]; then "$c" "$@"; return; fi
  done
  command openssl "$@"
}

raw="${ASC_KEY_P8-}"
[ -n "$raw" ] || fail "the secret is empty. Paste the whole AuthKey_XXXXXXXXXX.p8 file into it."

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
umask 077

# The base64 inside the PEM: drop literal \n / \r escapes, carriage returns and
# every other kind of whitespace, quotes, and any -----BEGIN ...----- /
# -----END ...----- line.
body_of() {
  printf '%s' "$1" \
    | sed -e 's/\\[nr]//g' \
    | tr -d ' \t\r\n"'"'" \
    | sed -E 's/-{3,}[A-Za-z ]*-{3,}//g'
}

body="$(body_of "$raw")"
for pass in 1 2; do
  [ -n "$body" ] || fail "nothing is left once the BEGIN/END lines are removed. Paste the whole .p8 file, including the lines between them."
  if printf '%s' "$body" | LC_ALL=C grep -q '[^A-Za-z0-9+/=]'; then
    fail "the key contains characters that cannot be in a .p8 file. Open AuthKey_XXXXXXXXXX.p8 in Notepad, copy everything, and paste it into the secret again."
  fi
  printf '%s' "$body" | openssl base64 -d -A > "$work/key.der" 2>/dev/null \
    || fail "the key is not valid base64. It may have been cut short when it was pasted; paste the whole .p8 file again."
  # the whole .p8 file base64-encoded once more: unwrap it and go round again
  if [ "$pass" = 1 ] && LC_ALL=C grep -q -- '-----BEGIN' "$work/key.der"; then
    body="$(body_of "$(cat "$work/key.der")")"
    continue
  fi
  break
done

openssl pkey -inform DER -in "$work/key.der" -out "$out" 2>/dev/null \
  || fail "openssl cannot read this as a private key ($(wc -c < "$work/key.der" | tr -d ' ') bytes decoded; an App Store Connect key is about 138). Download a new key in App Store Connect → Users and Access → Integrations if the original .p8 is gone."
chmod 600 "$out"

openssl pkey -in "$out" -noout -text 2>/dev/null | grep -Eq 'prime256v1|P-256' \
  || fail "this is a private key, but not an App Store Connect one (those are EC P-256). Check you pasted AuthKey_XXXXXXXXXX.p8 and not another key."

echo "ASC_KEY_P8: clean EC P-256 key, $(grep -c '' "$out") lines"
