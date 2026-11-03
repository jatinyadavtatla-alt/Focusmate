import com.focusmate.app.DnsFilter

var failures = 0
fun check(name: String, cond: Boolean) { if (cond) println("  ok  - $name") else { println("FAIL  - $name"); failures++ } }

fun dnsQuery(name: String, id: Int = 0xBEEF, qtype: Int = 1): ByteArray {
    val out = java.io.ByteArrayOutputStream()
    out.write(byteArrayOf((id shr 8).toByte(), id.toByte(), 0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 0))
    for (label in name.split('.')) { out.write(label.length); out.write(label.toByteArray()) }
    out.write(0); out.write(byteArrayOf(0, qtype.toByte(), 0, 1))
    return out.toByteArray()
}
fun udpPacket(dns: ByteArray, srcPort: Int = 40000, dstPort: Int = 53, ihl: Int = 20): ByteArray {
    val total = ihl + 8 + dns.size
    val p = ByteArray(total)
    p[0] = (0x40 or (ihl / 4)).toByte(); p[2] = (total shr 8).toByte(); p[3] = total.toByte(); p[8] = 64; p[9] = 17
    byteArrayOf(10, 7, 0, 2).copyInto(p, 12); byteArrayOf(10, 7, 0, 1).copyInto(p, 16)
    p[ihl] = (srcPort shr 8).toByte(); p[ihl + 1] = srcPort.toByte(); p[ihl + 2] = (dstPort shr 8).toByte(); p[ihl + 3] = dstPort.toByte()
    val ul = 8 + dns.size; p[ihl + 4] = (ul shr 8).toByte(); p[ihl + 5] = ul.toByte()
    dns.copyInto(p, ihl + 8); return p
}

fun main() {
    // normalisation
    check("normalize strips scheme/www/path", DnsFilter.normalizeDomain("https://www.YouTube.com/watch?v=1") == "youtube.com")
    check("normalize keeps subdomains", DnsFilter.normalizeDomain("old.reddit.com") == "old.reddit.com")
    check("normalize strips port", DnsFilter.normalizeDomain("example.com:8080/x") == "example.com")
    check("normalize rejects junk", DnsFilter.normalizeDomain("notadomain") == null && DnsFilter.normalizeDomain("a b.com") == null && DnsFilter.normalizeDomain("..com") == null)

    // matching
    val set = setOf("youtube.com", "reddit.com")
    check("exact match", DnsFilter.isBlocked(set, "youtube.com"))
    check("subdomain match", DnsFilter.isBlocked(set, "m.youtube.com") && DnsFilter.isBlocked(set, "WWW.Reddit.com."))
    check("no suffix false-positive", !DnsFilter.isBlocked(set, "notyoutube.com") && !DnsFilter.isBlocked(set, "youtube.com.evil.org"))

    // parsing
    val dns = dnsQuery("m.youtube.com")
    val q = DnsFilter.parseUdpDns(udpPacket(dns), udpPacket(dns).size)!!
    check("parse ports", q.srcPort == 40000 && q.dstPort == 53)
    check("parse payload identical", q.dns.contentEquals(dns))
    check("qname", DnsFilter.qname(q.dns) == "m.youtube.com")
    val withOpts = udpPacket(dns, ihl = 24)
    check("IP header with options", DnsFilter.parseUdpDns(withOpts, withOpts.size)?.let { DnsFilter.qname(it.dns) } == "m.youtube.com")
    check("non-DNS port ignored", DnsFilter.parseUdpDns(udpPacket(dns, dstPort = 443), udpPacket(dns, dstPort = 443).size) == null)
    val tcp = udpPacket(dns); tcp[9] = 6
    check("non-UDP ignored", DnsFilter.parseUdpDns(tcp, tcp.size) == null)
    check("truncated ignored", DnsFilter.parseUdpDns(udpPacket(dns), 20) == null)
    val v6 = udpPacket(dns); v6[0] = 0x60
    check("IPv6 ignored", DnsFilter.parseUdpDns(v6, v6.size) == null)
    check("malformed qname (overrun) is null", DnsFilter.qname(byteArrayOf(0,1,1,0,0,1,0,0,0,0,0,0, 50, 65)) == null)
    check("compression pointer in question is null", DnsFilter.qname(byteArrayOf(0,1,1,0,0,1,0,0,0,0,0,0, 0xC0.toByte(), 12)) == null)

    // NXDOMAIN reply
    val nx = DnsFilter.nxdomain(dns)
    check("nxdomain keeps transaction id", nx[0] == dns[0] && nx[1] == dns[1])
    check("nxdomain QR=1, RD echoed", (nx[2].toInt() and 0x80) != 0 && (nx[2].toInt() and 1) == 1)
    check("nxdomain RCODE=3, RA=1", (nx[3].toInt() and 0x0F) == 3 && (nx[3].toInt() and 0x80) != 0)
    check("nxdomain no answers, 1 question", nx[6].toInt() == 0 && nx[7].toInt() == 0 && nx[5].toInt() == 1)
    check("nxdomain echoes the question", DnsFilter.qname(nx) == "m.youtube.com" && nx.size == dns.size)

    // full response packet
    val resp = DnsFilter.buildResponsePacket(q, nx)
    check("response total length field", ((resp[2].toInt() and 0xFF) shl 8 or (resp[3].toInt() and 0xFF)) == resp.size)
    check("response IPs swapped", resp.copyOfRange(12, 16).contentEquals(byteArrayOf(10, 7, 0, 1)) && resp.copyOfRange(16, 20).contentEquals(byteArrayOf(10, 7, 0, 2)))
    check("response ports swapped", ((resp[20].toInt() and 0xFF) shl 8 or (resp[21].toInt() and 0xFF)) == 53 && ((resp[22].toInt() and 0xFF) shl 8 or (resp[23].toInt() and 0xFF)) == 40000)
    check("IP header checksum valid (sums to 0)", DnsFilter.checksum(resp, 0, 20) == 0)
    check("response payload is the DNS reply", resp.copyOfRange(28, resp.size).contentEquals(nx))
    // round trip: our own parser can read our own response shape (port/ip swapped)
    val back = DnsFilter.parseUdpDns(resp, resp.size)
    check("parseUdpDns rejects our reply (port != 53)", back == null)

    println(if (failures == 0) "\nALL DNS TESTS PASSED" else "\n$failures FAILED")
    if (failures > 0) System.exit(1)
}
