# Website blocking — exploration (not implemented)

Status: **implemented, experimental, opt-in** (`FocusVpnService.kt`, `DnsFilter.kt`). The packet logic is unit-tested on
a JVM; the VpnService itself is type-checked but has **never run on a device**. IPv4 DNS only (no IPv6 DNS).

## Recommended approach: local VpnService DNS filter
Android has no API for an app to block websites directly. The standard approach is a `VpnService` that
routes traffic into the app and answers DNS queries for blocked domains with NXDOMAIN / 0.0.0.0.
No traffic leaves the device and no backend is needed (stays offline-first).

1. `FocusVpnService : VpnService` — `Builder().addAddress("10.0.0.2", 32).addDnsServer("10.0.0.1").addRoute("10.0.0.1", 32)`
   so only DNS traffic is captured; everything else goes direct (no battery/speed penalty).
2. Read UDP/53 packets from the TUN fd, parse the question name, and either answer locally (blocked)
   or forward via a protected `DatagramSocket` (`protect()`) to the real resolver.
3. Match domains + subdomains against `website_rules`, only while `BlockPolicy.isBlockingNow()`.
4. JS bridge: `prepareVpn()` (launches `VpnService.prepare()` consent dialog), `startVpn()/stopVpn()`.
   Tie start/stop to the same `syncSessionState` transitions already used for app blocking.
5. Manifest: service with `android.permission.BIND_VPN_SERVICE`, plus a foreground-service type.

## Known limits (be honest in the UI)
- **Private DNS / DNS-over-HTTPS** in browsers (Chrome "Secure DNS") bypasses plain-DNS filtering.
  Mitigations: detect and warn, or also block known DoH endpoints.
- Only one VPN can be active; users of a real VPN would conflict.
- Play Store: VpnService apps require a declared, justified use.
- Needs careful device testing (IPv6, captive portals, battery, always-on VPN).

## Suggested next step
Prototype the DNS-only TUN loop in a separate branch and test on a physical device before wiring any UI.
