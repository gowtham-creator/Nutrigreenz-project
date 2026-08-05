#!/usr/bin/env bash
#
# SBIePay static-IP proxy — one-shot install.
#
# Run ON the EC2 instance (Amazon Linux 2023), once the Elastic IP is attached:
#
#   sudo bash sbiepay-proxy-install.sh
#
# It prints the proxy URL to paste into Vercel as SBIEPAY_PROXY_URL, and the
# egress IP to give SBI. Nothing else needs configuring.
#
# ── What this box is for ──────────────────────────────────────────────────
#
# SBI whitelists one merchant IP. Vercel functions have no stable outbound
# address, so their calls arrive from an IP the bank does not recognise and are
# refused. This proxy holds the whitelisted Elastic IP and relays only SBIePay
# traffic; everything else on the site continues to leave Vercel directly.
#
# ── Why it authenticates ──────────────────────────────────────────────────
#
# Vercel publishes no fixed egress range, so the security group cannot restrict
# by source IP — port 8443 has to accept 0.0.0.0/0. An open proxy on a public
# address is found by scanners within hours, and traffic relayed through it
# would appear to SBI as coming from your whitelisted payment IP. Authentication
# is therefore not optional here; it is the only thing standing in for the
# network restriction that cannot exist.

set -euo pipefail

PORT=8443
USER_NAME=nutrigreenz
PASS_FILE=/etc/squid/passwd
CONF=/etc/squid/squid.conf

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo." >&2
  exit 1
fi

echo "==> Installing squid + htpasswd"
dnf install -y squid httpd-tools >/dev/null

# Generated, not chosen: a memorable password on a public port is the weak link.
PASSWORD="$(openssl rand -base64 30 | tr -d '/+=' | head -c 32)"

echo "==> Creating credentials"
htpasswd -bc "$PASS_FILE" "$USER_NAME" "$PASSWORD" >/dev/null 2>&1
chown squid:squid "$PASS_FILE"
chmod 640 "$PASS_FILE"

# The basic-auth helper path differs between builds; find it rather than assume.
BASIC_AUTH="$(find /usr/lib64/squid /usr/lib/squid -name basic_ncsa_auth 2>/dev/null | head -1)"
if [[ -z "$BASIC_AUTH" ]]; then
  echo "Could not find basic_ncsa_auth — is squid installed?" >&2
  exit 1
fi

echo "==> Writing $CONF"
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

echo "==> Starting squid"
systemctl enable --now squid >/dev/null 2>&1
sleep 2
systemctl is-active --quiet squid || { echo "squid failed to start:"; journalctl -u squid -n 20 --no-pager; exit 1; }

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
echo " Confirm the security group allows inbound TCP $PORT from 0.0.0.0/0,"
echo " and that port 22 is CLOSED (use EC2 Instance Connect for shell access)."
echo
echo " Test from your Mac:"
echo "   curl -x http://$USER_NAME:$PASSWORD@$EGRESS:$PORT \\"
echo "        https://integration.sbiepay.sbiuat.bank.in -I --max-time 15"
echo
