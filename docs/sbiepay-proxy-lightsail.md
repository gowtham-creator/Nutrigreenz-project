# SBIePay proxy — the box already exists (Lightsail)

**The whitelisted IP `15.252.0.167` is a Lightsail static IP, not an EC2
Elastic IP.** That is why it never appears under EC2 → Network & Security →
Elastic IPs, and why allocating a new Elastic IP does not help: the two are
different resources from different services, and a Lightsail static IP cannot be
attached to an EC2 instance.

`docs/sbiepay-static-ip-aws.md` describes building this on EC2. That document
predates knowing Lightsail was already in use. **Follow this file instead.**

Verified 6 Aug 2026 from outside AWS:

| Port | Result | Meaning |
|---|---|---|
| 22 | open | the instance is alive and reachable |
| 8443 | timeout | the Lightsail firewall has no rule for it |
| 80 | refused | firewall allows it; nothing is listening |

So the instance is running. Two things remain: open 8443, install squid.

---

## 1. Release the Elastic IP that was allocated by mistake

EC2 → Network & Security → **Elastic IPs** → select `3.108.36.1` → Actions →
**Release Elastic IP addresses**.

AWS bills every public IPv4 address whether or not it is attached — about
$3.60/month — so an unused allocation is a standing charge for nothing.

Do **not** touch `15.252.0.167`. SBI has whitelisted it, and releasing it means
starting their whitelisting process again.

## 2. Do not launch the EC2 instance

Cancel that wizard. A second box would have a different IP, which SBI would
refuse, and would cost another ~$3/month.

## 3. Open port 8443

Lightsail → your instance → **Networking** tab → **IPv4 Firewall** →
**Add rule**:

| Field | Value |
|---|---|
| Application | Custom |
| Protocol | TCP |
| Port | 8443 |
| Restrict to IP address | leave OFF |

Open to the internet is correct here. Vercel publishes no fixed egress range, so
there is nothing to restrict to — which is exactly why the proxy authenticates
every request and only permits SBI destinations.

## 4. Connect

Lightsail → instance → **Connect** tab → **Connect using SSH**. Browser-based,
no key pair needed.

## 5. Install

In the browser terminal, type this line first:

```
cat > install.sh <<'NGEOF'
```

Then paste the entire contents of `docs/sbiepay-proxy-install.sh`, press Enter,
type `NGEOF`, press Enter. Then:

```
sudo bash install.sh
```

It prints the proxy URL. **Copy it — the password is shown once.**

## 6. Wire it up

Vercel → Settings → Environment Variables → `SBIEPAY_PROXY_URL` → paste →
save for **Production and Preview** → **Redeploy** (an env var only takes effect
on a new deployment).

Then Admin → Config → Payment gateway → **Run self-test**. All four green.

---

## Afterwards, worth doing

Lightsail leaves SSH open to the whole internet by default. Once the proxy is
running, restrict port 22 under the same firewall panel — tick **Restrict to IP
address** and enter yours. That disables the browser SSH button, so you would
connect with your own client using the key from Lightsail → Account → SSH keys.

Not a blocker for testing, but this box holds a credential that reaches the
bank, and a permanently open SSH port on a public address is found by scanners
within hours.
