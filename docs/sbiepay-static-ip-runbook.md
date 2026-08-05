# SBIePay static IP — runbook

**Platform: AWS Lightsail, Mumbai (ap-south-1). ~$5/month, static IP included.**

Chosen over EC2 because the AWS account is empty: Lightsail bundles instance,
static IP, firewall and browser SSH into one product, with no VPC or
security-group concepts to get wrong. It is also cheaper — EC2 would be ~$3/mo
for the instance plus ~$3.60/mo for the IPv4 address.

Nothing here touches Vercel. The site's build, domains, DNS and deploys are
unaffected. The only Vercel-side change is one environment variable in Phase 4.

---

## Phase 1 — Get the address (do this first, ~5 minutes)

The address is the long pole: SBI's whitelisting is not instant, so get it into
their hands today and build the rest while they process it.

1. AWS Console → search **Lightsail** → open it.
2. Set the region to **Mumbai (ap-south-1)**. A static IP is locked to its
   region and cannot be moved later.
3. **Create instance**
   - Platform: **Linux/Unix**
   - Blueprint: **OS Only → Amazon Linux 2023**
   - Plan: the **smallest** one (512 MB is ample — this relays API calls)
   - Name: `nutrigreenz-payment-proxy`
   - **Create instance**, wait for *Running*.
4. Top nav → **Networking** → **Create static IP**
   - Attach it to `nutrigreenz-payment-proxy`
   - Name: `nutrigreenz-sbiepay-ip`
   - **Create**
5. **Copy the address. This is what you send SBI.**

### Send SBI this, today

> Please whitelist the following merchant server IP for our SBIePay integration:
> `<address>`
>
> Could you also confirm:
> 1. Do UAT and production require separate whitelisting requests?
> 2. What is the exact API hostname our server will call?
> 3. What is the expected turnaround for whitelisting?

Answers 1 and 3 set the go-live date. Answer 2 is needed for Phase 2, step 4.

> **Do not release this IP once whitelisted.** Releasing returns it to Amazon's
> pool, and a new address means repeating SBI's whitelisting process.

---

## Phase 2 — Build the proxy (~20 minutes, can wait for SBI)

### 1. Open the proxy port

Lightsail → your instance → **Networking** tab → **IPv4 Firewall** → Add rule:

| Application | Protocol | Port |
|---|---|---|
| Custom | TCP | 8443 |

Leave SSH as Lightsail configured it. Do not add any other rule.

### 2. Connect

Instance page → **Connect using SSH** (opens a browser terminal — no key files
to manage).

### 3. Install

```bash
sudo dnf install -y squid httpd-tools
```

### 4. Create the credential

```bash
openssl rand -base64 24        # copy this — it is shown once
sudo htpasswd -c /etc/squid/passwd nutrigreenz
```

Paste the generated string when prompted for a password. Keep it somewhere safe;
it goes into Vercel in Phase 4 and nowhere else.

### 5. Configure Squid

```bash
sudo tee /etc/squid/squid.conf >/dev/null <<'EOF'
auth_param basic program /usr/lib64/squid/basic_ncsa_auth /etc/squid/passwd
auth_param basic realm proxy
acl authenticated proxy_auth REQUIRED

# Lock the proxy to SBI only. Replace with the hostname SBI confirms.
acl sbi dstdomain .sbiepay.sbi
acl ssl_ports port 443
acl CONNECT method CONNECT

http_access deny CONNECT !ssl_ports
http_access allow authenticated sbi
http_access deny all

http_port 8443

# Don't advertise the client or the proxy itself.
forwarded_for delete
via off
EOF

sudo squid -k parse          # must print no errors before continuing
sudo systemctl enable --now squid
```

The `dstdomain` line is the important one: it means a leaked credential can only
ever reach SBI, never be used as a general-purpose open relay.

### 6. Keep it patched

This box is internet-facing and sits in the payment path.

```bash
sudo dnf install -y dnf-automatic
sudo sed -i 's/^apply_updates = no/apply_updates = yes/' /etc/dnf/automatic.conf
sudo systemctl enable --now dnf-automatic.timer
```

---

## Phase 3 — Verify from the box

```bash
curl -s https://checkip.amazonaws.com
```

This must print the Lightsail static IP. **Verify here, not from the console** —
whitelisting the wrong address is a week's delay.

Then confirm the proxy works and is locked down:

```bash
# Should succeed (200) — through the proxy, to an allowed destination:
curl -x http://nutrigreenz:<password>@localhost:8443 -sI https://<sbi-host>/

# Should be DENIED (403) — proves it is not an open relay:
curl -x http://nutrigreenz:<password>@localhost:8443 -sI https://example.com/

# Should be DENIED (407) — proves auth is required:
curl -x http://localhost:8443 -sI https://<sbi-host>/
```

All three must behave as stated. If the second one succeeds, the `dstdomain`
rule is wrong and the box is an open relay — fix before going further.

---

## Phase 4 — Vercel side

Add to Vercel → Project → Settings → Environment Variables, marked **Sensitive**,
Production (and Preview if you want to test there):

```
SBIEPAY_PROXY_URL = http://nutrigreenz:<password>@<static-ip>:8443
```

Then the payment client routes SBI calls through it. Nothing else in the app
reads this variable, so the change is contained to the payment module.

**Final check, from a Vercel function — not from your laptop.** Your laptop has
a different IP and will pass even if the proxy is being bypassed entirely. Call
an IP echo service through the proxy and assert the response equals the static
IP. If it returns anything else, traffic is not going through the proxy and SBI
will reject it.

---

## Residual risk, stated plainly

Vercel has no fixed egress range, so the firewall rule cannot be narrowed by
source IP — port 8443 is open to the internet. Two things contain that:

- The proxy requires authentication, so it is not usable anonymously.
- It can only reach SBI, so even a leaked credential yields nothing useful —
  and SBI calls still require merchant credentials in the payload, which an
  attacker would not have.

The payment traffic itself is a CONNECT tunnel, so it is end-to-end TLS between
Vercel and SBI; the proxy never sees inside it.

**Single point of failure:** one instance means payments stop if it goes down.
The site, admin portal and existing orders are unaffected. Acceptable at current
volume. When volume justifies it, the upgrade is two instances behind a load
balancer with SBI whitelisting the balancer's address — worth revisiting later,
not worth building now.
