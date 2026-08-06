#!/usr/bin/env bash
#
# SBIePay static-IP proxy — one-shot install.
#
# Run ON the Lightsail instance (Amazon Linux 2023), which already holds the
# static IP that SBI has whitelisted:
#
#   sudo bash sbiepay-proxy-install.sh
#
# Safe to re-run: it overwrites the config and issues a fresh password.
#
# It prints the proxy URL to paste into Vercel as SBIEPAY_PROXY_URL, and the
# egress IP to give SBI. Nothing else needs configuring.
#
# ── What this box is for ──────────────────────────────────────────────────
#
# SBI whitelists one merchant IP. Vercel functions have no stable outbound
# address, so their calls arrive from an IP the bank does not recognise and are
# refused. This proxy holds the whitelisted static IP and relays only SBIePay
# traffic; everything else on the site continues to leave Vercel directly.
#
# Note this is a Lightsail static IP, not an EC2 Elastic IP — they are separate
# services and a Lightsail address never appears on the EC2 Elastic IPs page.
#
# ── Why it authenticates ──────────────────────────────────────────────────
#
# Vercel publishes no fixed egress range, so the firewall cannot restrict
# by source IP — port 8443 has to accept any address. An open proxy on a public
# address is found by scanners within hours, and traffic relayed through it
# would appear to SBI as coming from your whitelisted payment IP. Authentication
# is therefore not optional here; it is the only thing standing in for the
# network restriction that cannot exist.

set -euo pipefail

# Report where we died.
#
# An earlier version of this script suppressed stderr on htpasswd. When that
# step failed, `set -e` exited with no output at all — the operator got a bare
# shell prompt and no way to tell whether it had succeeded. Every command below
# now keeps its stderr, and this trap names the line if one still fails.
trap 'echo; echo "FAILED at line $LINENO while running: $BASH_COMMAND" >&2' ERR

PORT=8443
USER_NAME=nutrigreenz
PASS_FILE=/etc/squid/passwd
CONF=/etc/squid/squid.conf

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo:  sudo bash $0" >&2
  exit 1
fi

echo "==> [1/6] Installing squid + htpasswd"
dnf install -y squid httpd-tools

# Verify rather than trust. dnf can report success having skipped a package that
# is masked or already-but-partially installed, and every later step assumes
# both of these exist.
echo "==> [2/6] Verifying the install"
command -v htpasswd >/dev/null || { echo "htpasswd missing — 'dnf install httpd-tools' did not take" >&2; exit 1; }
command -v squid    >/dev/null || { echo "squid missing — 'dnf install squid' did not take" >&2; exit 1; }
mkdir -p /etc/squid
echo "    squid:    $(squid -v 2>/dev/null | head -1 || true)"
echo "    htpasswd: $(command -v htpasswd)"

# Generated, not chosen: a memorable password on a public port is the weak link.
#
# `head -c` closes the pipe early, which kills `tr` with SIGPIPE — under
# `pipefail` that is a non-zero exit and would abort the script. Truncating
# afterwards keeps the pipeline intact.
RAW="$(openssl rand -base64 30 | tr -d '/+=')"
PASSWORD="${RAW:0:32}"

echo "==> [3/6] Creating credentials"
htpasswd -bc "$PASS_FILE" "$USER_NAME" "$PASSWORD"
# The squid user is created by the package, but do not make the script fatal on
# a build that names it differently — the file permissions below are what
# actually matter.
chown squid:squid "$PASS_FILE" 2>/dev/null || echo "    (no squid user yet — leaving ownership as root)"
chmod 640 "$PASS_FILE"

# The basic-auth helper path differs between builds; find it rather than assume.
#
# Searched one directory at a time, skipping any that do not exist. `find` exits
# non-zero when handed a missing path even with stderr silenced, and piping it
# into `head` under `pipefail` turns that into an aborted install — which is
# exactly what happened on the first Lightsail run, where only /usr/lib64/squid
# is present. `-print -quit` also removes the pipe entirely, so there is no
# SIGPIPE to propagate either.
echo "==> [4/6] Locating the auth helper"
BASIC_AUTH=""
for dir in /usr/lib64/squid /usr/lib/squid /usr/libexec/squid; do
  [[ -d "$dir" ]] || continue
  found="$(find "$dir" -name basic_ncsa_auth -print -quit 2>/dev/null || true)"
  if [[ -n "$found" ]]; then
    BASIC_AUTH="$found"
    break
  fi
done
if [[ -z "$BASIC_AUTH" ]]; then
  echo "Could not find basic_ncsa_auth in any squid lib directory." >&2
  echo "Run this and send the output:  rpm -ql squid | grep ncsa" >&2
  exit 1
fi
echo "    $BASIC_AUTH"

echo "==> [5/6] Writing $CONF"
cat > "$CONF" <<EOF
# SBIePay egress proxy. Deliberately minimal: it forwards authenticated CONNECT
# requests to SBI and refuses everything else.

http_port $PORT

auth_param basic program $BASIC_AUTH $PASS_FILE
auth_param basic children 5
auth_param basic realm nutrigreenz
auth_param basic credentialsttl 12 hours

acl authenticated proxy_auth REQUIRED

# Only SBI. If this proxy is ever misused, it can still only reach the bank —
# it cannot be turned into a general-purpose relay.
acl sbi_domains dstdomain .sbi.bank.in .sbiuat.bank.in .epay.sbi
acl ssl_ports port 443
acl CONNECT method CONNECT

http_access deny !authenticated
http_access deny CONNECT !ssl_ports
http_access allow authenticated sbi_domains
http_access deny all

# Force IPv4 for outbound connections.
#
# This instance is dual-stack, and Linux prefers IPv6 when a destination
# publishes both A and AAAA records. SBI whitelisted the IPv4 static address,
# so an IPv6 egress would arrive from an address they have never seen and be
# refused — while everything on this box looked correctly configured.
dns_v4_first on

# No caching. Payment traffic must never be served from a cache, and a cache on
# this box would be storing fragments of financial requests on disk.
cache deny all
cache_dir null /tmp

# Strip identifying headers rather than announcing the relay.
via off
forwarded_for delete
request_header_access X-Forwarded-For deny all

# A payment call that has not completed in 60s is not going to.
connect_timeout 20 seconds
read_timeout 60 seconds

access_log /var/log/squid/access.log
EOF

echo "==> [6/6] Starting squid"
# Validate the config before starting. `squid -k parse` names the offending
# directive and line; a failed start only says "job failed", which is the
# difference between a one-line fix and reading journalctl.
squid -k parse || { echo "The config above is not valid — not starting." >&2; exit 1; }

systemctl enable --now squid
# Re-running this script on a box where squid is already up needs a restart, not
# an enable, or the old config stays loaded and the new one looks ignored.
systemctl restart squid
sleep 2
systemctl is-active --quiet squid || {
  echo "squid failed to start:" >&2
  journalctl -u squid -n 30 --no-pager >&2
  exit 1
}

echo "==> Verifying egress address"
EGRESS="$(curl -s --max-time 10 https://checkip.amazonaws.com || echo "unknown")"

echo
echo "──────────────────────────────────────────────────────────────"
echo " Proxy is running."
echo
echo " Egress IP (this is what SBI whitelists):"
echo "   $EGRESS"
echo
echo " Set in Vercel as SBIEPAY_PROXY_URL (Production + Preview, sensitive):"
echo "   http://$USER_NAME:$PASSWORD@$EGRESS:$PORT"
echo
echo " This password is shown ONCE. It is not recoverable — rerun this"
echo " script to issue a new one."
echo "──────────────────────────────────────────────────────────────"
echo
echo " Firewall: Lightsail > Instances > this instance > Networking >"
echo " IPv4 Firewall must allow TCP $PORT with Source = Any IP address."
echo " (Vercel publishes no fixed egress range, so this cannot be narrowed —"
echo "  the proxy password is what stands in for the missing IP restriction.)"
echo
echo " Test from your Mac:"
echo "   curl -x http://$USER_NAME:$PASSWORD@$EGRESS:$PORT \\"
echo "        https://integration.sbiepay.sbiuat.bank.in -I --max-time 15"
echo
