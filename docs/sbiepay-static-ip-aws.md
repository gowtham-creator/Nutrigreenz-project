# Static IP for SBIePay, on AWS

## The short answer to your question

**Correct — this does not touch your Vercel deployment, and there is no
infrastructure dependency between them.**

The AWS piece is a small, standalone box that sits beside Vercel, not under it.
Nothing about the build, the domains, the DNS, the preview deploys or the
production promotion changes. You could delete the whole AWS stack tomorrow and
the site would still deploy and serve exactly as it does now.

There **is** one deliberate link, in one direction only, and it is worth being
precise about it because it decides your failure modes:

- Vercel functions will send **outbound SBIePay API calls** through the proxy,
  so those calls leave from the whitelisted IP. That is a config change on the
  Vercel side: one environment variable.
- Nothing on AWS ever calls into Vercel. AWS never becomes a dependency of page
  loads, the admin portal, the storefront, or anything else.

**Blast radius if the AWS box dies:** card payments fail. The site stays up, the
admin portal stays up, orders already placed are unaffected, and every other
feature works. That is a much smaller failure surface than putting the whole app
behind a proxy, which is why it is worth doing this way rather than migrating
off Vercel.

## Why this is needed at all

SBIePay whitelists a fixed merchant IP for server-to-server calls. Vercel
functions run on shared infrastructure and have **no stable outbound IP** — the
address changes between invocations and regions, so there is nothing to give
the bank. The proxy exists purely to give those calls one permanent address.

---

## What to build

The smallest correct thing is a **NAT Gateway with an Elastic IP**, with a tiny
forward proxy in a private subnet behind it. Outbound traffic from the proxy
leaves via the NAT Gateway's Elastic IP — the one address you hand to SBI.

```
Vercel function ──HTTPS──▶ proxy (private subnet, EC2 t4g.nano)
                                  │
                                  └──▶ NAT Gateway ──▶ Elastic IP ──▶ SBIePay
                                                        ▲
                                              this is the whitelisted IP
```

### Cost (ap-south-1, Mumbai — keep it in-region, SBI is in India)

| Item | Monthly |
|---|---|
| NAT Gateway (hourly) | ~$32 |
| NAT data processing | ~$0.05/GB — negligible for API calls |
| EC2 t4g.nano proxy | ~$3 |
| Elastic IP (in use) | free |
| **Total** | **~$35/month** |

If ~$35/month is not worth it, a **managed static-IP proxy** (QuotaGuard Static,
Fixie) does the same job from about $20/month with no infrastructure to own. The
tradeoff is that a third party then sits in your payment path. For a payment
gateway I would rather own the box, but this is a legitimate choice — say the
word and I will write that variant up instead.

> **Cheaper AWS variant:** skip the NAT Gateway and put the proxy directly in a
> **public** subnet with the Elastic IP attached to the instance itself. That is
> ~$3/month instead of ~$35. It is a smaller, simpler setup, and the security
> difference is manageable if the security group is locked down as below. The
> NAT design is the more conventional production shape; the public-subnet design
> is honestly fine at this scale. **I would start with the cheap one.**

---

## Steps — public-subnet variant (recommended to start)

Region: **ap-south-1 (Mumbai)**.

### 1. Allocate the Elastic IP first

Console → EC2 → Network & Security → **Elastic IPs** → Allocate.

Do this first, because **this address is what you give SBI**, and you want it
before you start the paperwork with them — their whitelisting is not instant.

Since February 2024 AWS charges for **all** public IPv4 addresses — roughly
$3.60/month — whether attached or idle. So allocating it today, before the proxy
exists, costs nothing extra.

Set the region to **ap-south-1** *before* allocating: an Elastic IP is locked to
its region and cannot be moved.

**Do not release it once SBI has whitelisted it.** Releasing returns it to
Amazon's pool, and a new address means repeating their whitelisting process.

### 2. Launch the proxy instance

EC2 → Launch instance:

- **Name:** `nutrigreenz-payment-proxy`
- **AMI:** Amazon Linux 2023 (ARM64)
- **Type:** `t4g.nano`
- **Key pair:** create one and keep it safe — it is your only way in
- **Subnet:** any public subnet, **auto-assign public IP: enabled**
- **Storage:** 8 GB gp3 default is plenty

### 3. Security group — this is the part that matters

Inbound: **one rule only.**

| Type | Port | Source |
|---|---|---|
| Custom TCP | 8443 | `0.0.0.0/0` |

Vercel has no fixed egress range, so the source cannot be narrowed by IP. That
is exactly why **the proxy must authenticate every request** — see step 5. An
open proxy with no auth would be found by scanners within hours and used to
relay traffic that then appears to come from your whitelisted payment IP.

Do **not** open SSH to the world. Use **EC2 Instance Connect** or **SSM Session
Manager** for shell access, and leave port 22 closed.

Outbound: leave the default allow-all, or tighten to HTTPS-to-SBI only.

### 4. Attach the Elastic IP

EC2 → Elastic IPs → select yours → Actions → **Associate** → pick the instance.

Confirm from the box: `curl -s https://checkip.amazonaws.com` should print the
Elastic IP. **That printed value is what SBI whitelists** — verify it from the
instance rather than trusting the console, so you cannot whitelist the wrong
address.

### 5. Install the proxy, with authentication

Squid with basic auth over TLS is the boring, well-understood choice:

```bash
sudo dnf install -y squid httpd-tools
# One strong credential. Generate the password with: openssl rand -base64 32
sudo htpasswd -c /etc/squid/passwd nutrigreenz
```

In `/etc/squid/squid.conf`, require auth and restrict the destination:

```
auth_param basic program /usr/lib64/squid/basic_ncsa_auth /etc/squid/passwd
acl authenticated proxy_auth REQUIRED
acl sbi dstdomain .sbiepay.sbi          # confirm the exact host with SBI
http_access allow authenticated sbi
http_access deny all
http_port 8443
```

Restricting the destination is what stops a leaked credential from turning the
box into a general-purpose open relay. It can only ever reach SBI.

```bash
sudo systemctl enable --now squid
```

Then set up **unattended security updates** — this box is internet-facing and
sits in your payment path, so an unpatched instance is a real risk, not a
theoretical one.

### 6. Give SBI the address

Send them the Elastic IP for whitelisting. Ask explicitly whether they whitelist
for both **UAT and production**, and whether those are separate submissions —
they usually are, and discovering that late costs a week.

### 7. Wire up the Vercel side

Add to Vercel (Production, and Preview if you want to test there):

```
SBIEPAY_PROXY_URL = http://nutrigreenz:<password>@<elastic-ip>:8443
```

Store it as a **Sensitive** environment variable — it contains a credential.
Never commit it; never print it into logs.

The payment client then routes through it. Nothing else in the app reads this,
so the change is contained to the payment module.

### 8. Verify before flipping the switch

From a Vercel function (not from your laptop — your laptop has a different IP
and will pass even if the proxy is bypassed), call an IP echo service through
the proxy and assert the response equals the Elastic IP. If it returns anything
else, the traffic is not going through the proxy and SBI will reject it.

---

## What I need from you to finish the app side

1. The Elastic IP, once allocated (I do not need it to write the code).
2. Confirmation of SBI's exact API hostname, for the `dstdomain` rule.
3. Whether UAT and production whitelist separately.

## Open risk worth naming

A single EC2 instance is a **single point of failure for payments**. It is
acceptable at your current volume, and far better than the alternative of having
no gateway at all. When payment volume justifies it, the upgrade path is two
instances behind a Network Load Balancer with a static IP — SBI whitelists the
NLB address, and either instance can fail without taking payments down. Worth
revisiting, not worth building now.
