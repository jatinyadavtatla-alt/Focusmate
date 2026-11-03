package com.focusmate.app

/**
 * Pure packet logic for the website filter (no Android imports, so it runs in plain JVM tests).
 * Only IPv4 + UDP + port 53 packets are handled; that is all the VPN routes into the app.
 */
object DnsFilter {

    class Query(
        val srcIp: ByteArray,
        val dstIp: ByteArray,
        val srcPort: Int,
        val dstPort: Int,
        val dns: ByteArray
    )

    /** Normalises user input like "https://www.Example.com/path" to "example.com". */
    fun normalizeDomain(input: String): String? {
        var d = input.trim().lowercase()
        d = d.removePrefix("https://").removePrefix("http://")
        d = d.substringBefore('/').substringBefore('?').substringBefore('#').substringBefore(':')
        d = d.removePrefix("www.").trimEnd('.')
        if (d.length < 3 || !d.contains('.')) return null
        if (!d.all { it.isLetterOrDigit() || it == '-' || it == '.' }) return null
        if (d.startsWith(".") || d.contains("..")) return null
        return d
    }

    /** True if [qname] is one of [domains] or a subdomain of one. */
    fun isBlocked(domains: Set<String>, qname: String): Boolean {
        val n = qname.lowercase().trimEnd('.')
        for (d in domains) {
            if (n == d || n.endsWith(".$d")) return true
        }
        return false
    }

    fun parseUdpDns(pkt: ByteArray, len: Int): Query? {
        if (len < 28) return null
        val version = (pkt[0].toInt() and 0xF0) shr 4
        if (version != 4) return null
        val ihl = (pkt[0].toInt() and 0x0F) * 4
        if (ihl < 20 || len < ihl + 8) return null
        if ((pkt[9].toInt() and 0xFF) != 17) return null // UDP only
        val srcPort = u16(pkt, ihl)
        val dstPort = u16(pkt, ihl + 2)
        if (dstPort != 53) return null
        val udpLen = u16(pkt, ihl + 4)
        val dnsLen = Math.min(udpLen - 8, len - ihl - 8)
        if (dnsLen < 12) return null
        return Query(
            pkt.copyOfRange(12, 16),
            pkt.copyOfRange(16, 20),
            srcPort,
            dstPort,
            pkt.copyOfRange(ihl + 8, ihl + 8 + dnsLen)
        )
    }

    /** First question name of a DNS message, or null if malformed. */
    fun qname(dns: ByteArray): String? {
        if (dns.size < 13) return null
        if (u16(dns, 4) < 1) return null // QDCOUNT
        var pos = 12
        val sb = StringBuilder()
        while (true) {
            if (pos >= dns.size) return null
            val l = dns[pos].toInt() and 0xFF
            if (l == 0) break
            if (l and 0xC0 != 0) return null // compression pointers never appear in a question
            if (pos + 1 + l > dns.size) return null
            if (sb.isNotEmpty()) sb.append('.')
            for (i in 1..l) sb.append((dns[pos + i].toInt() and 0xFF).toChar())
            pos += 1 + l
        }
        return sb.toString()
    }

    /** NXDOMAIN reply echoing the question section. */
    fun nxdomain(dns: ByteArray): ByteArray {
        var pos = 12
        while (pos < dns.size && dns[pos].toInt() != 0) pos += (dns[pos].toInt() and 0xFF) + 1
        val end = Math.min(dns.size, pos + 1 + 4) // root label + QTYPE + QCLASS
        val out = dns.copyOfRange(0, end)
        val rd = out[2].toInt() and 0x01
        out[2] = (0x80 or rd).toByte()          // QR=1, opcode 0, RD echoed
        out[3] = (0x80 or 0x03).toByte()        // RA=1, RCODE=3 (NXDOMAIN)
        out[6] = 0; out[7] = 0                  // ANCOUNT
        out[8] = 0; out[9] = 0                  // NSCOUNT
        out[10] = 0; out[11] = 0                // ARCOUNT
        return out
    }

    /** Wraps a DNS reply as an IPv4/UDP packet addressed back to the querier. */
    fun buildResponsePacket(q: Query, dnsReply: ByteArray): ByteArray {
        val total = 20 + 8 + dnsReply.size
        val p = ByteArray(total)
        p[0] = 0x45
        p[2] = (total shr 8).toByte(); p[3] = total.toByte()
        p[6] = 0x40 // Don't Fragment
        p[8] = 64   // TTL
        p[9] = 17   // UDP
        System.arraycopy(q.dstIp, 0, p, 12, 4) // reply comes FROM the address that was queried
        System.arraycopy(q.srcIp, 0, p, 16, 4)
        val ck = checksum(p, 0, 20)
        p[10] = (ck shr 8).toByte(); p[11] = ck.toByte()
        p[20] = (q.dstPort shr 8).toByte(); p[21] = q.dstPort.toByte()
        p[22] = (q.srcPort shr 8).toByte(); p[23] = q.srcPort.toByte()
        val udpLen = 8 + dnsReply.size
        p[24] = (udpLen shr 8).toByte(); p[25] = udpLen.toByte()
        // UDP checksum 0 = "not computed", legal for IPv4
        System.arraycopy(dnsReply, 0, p, 28, dnsReply.size)
        return p
    }

    fun checksum(b: ByteArray, off: Int, len: Int): Int {
        var sum = 0L
        var i = off
        while (i < off + len - 1) {
            sum += ((b[i].toInt() and 0xFF) shl 8) or (b[i + 1].toInt() and 0xFF)
            i += 2
        }
        if (len % 2 == 1) sum += (b[off + len - 1].toInt() and 0xFF) shl 8
        while (sum shr 16 != 0L) sum = (sum and 0xFFFF) + (sum shr 16)
        return (sum.inv() and 0xFFFF).toInt()
    }

    private fun u16(b: ByteArray, off: Int) = ((b[off].toInt() and 0xFF) shl 8) or (b[off + 1].toInt() and 0xFF)
}
