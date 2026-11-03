package com.focusmate.app

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.VpnService
import android.os.ParcelFileDescriptor
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Local DNS filter. The VPN only routes ONE address (the fake DNS server 10.7.0.1) into the app, so all
 * other traffic bypasses it. Each DNS query is either answered NXDOMAIN (blocked site during a focus
 * block) or forwarded to the real resolver through a protect()ed socket. Nothing leaves the device
 * except normal DNS lookups. Limitation: DNS-over-TLS/HTTPS ("Private DNS", Chrome "Secure DNS") is not seen.
 */
class FocusVpnService : VpnService() {

    companion object {
        const val ACTION_START = "com.focusmate.app.VPN_START"
        const val ACTION_STOP = "com.focusmate.app.VPN_STOP"
        const val KEY_DOMAINS = "blocked_domains"
        private const val FAKE_DNS = "10.7.0.1"
        private const val CLIENT_ADDR = "10.7.0.2"

        @Volatile
        var isRunning: Boolean = false
    }

    private var tun: ParcelFileDescriptor? = null
    private var reader: Thread? = null
    private var pool: ExecutorService? = null
    @Volatile private var running = false
    private var upstream: InetAddress = InetAddress.getByName("1.1.1.1")

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            shutdown()
            stopSelf()
            return START_NOT_STICKY
        }
        if (intent?.action == ACTION_START && !running) startFilter()
        return START_NOT_STICKY
    }

    private fun startFilter() {
        // The real resolver must be read BEFORE our VPN becomes the active network.
        upstream = findSystemResolver()
        val fd = try {
            Builder()
                .setSession("FocusMate website blocker")
                .addAddress(CLIENT_ADDR, 32)
                .addDnsServer(FAKE_DNS)
                .addRoute(FAKE_DNS, 32)
                .setBlocking(true)
                .establish()
        } catch (_: Exception) {
            null
        }
        if (fd == null) { // user has not granted VPN consent (or another VPN took over)
            stopSelf()
            return
        }
        tun = fd
        running = true
        isRunning = true
        pool = Executors.newFixedThreadPool(4)
        reader = Thread({ pump(fd) }, "focusmate-dns").also { it.start() }
    }

    private fun findSystemResolver(): InetAddress {
        try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val dns = cm.getLinkProperties(cm.activeNetwork)?.dnsServers?.firstOrNull { it is Inet4Address }
            if (dns != null) return dns
        } catch (_: Exception) {
        }
        return InetAddress.getByName("1.1.1.1")
    }

    private fun pump(fd: ParcelFileDescriptor) {
        val input = FileInputStream(fd.fileDescriptor)
        val output = FileOutputStream(fd.fileDescriptor)
        val buf = ByteArray(32767)
        try {
            while (running) {
                val n = input.read(buf)
                if (n <= 0) continue
                val q = DnsFilter.parseUdpDns(buf, n) ?: continue
                try {
                    pool?.execute { answer(q, output) }
                } catch (_: Exception) {
                }
            }
        } catch (_: Exception) {
            // tunnel closed
        } finally {
            shutdown()
        }
    }

    private fun answer(q: DnsFilter.Query, output: FileOutputStream) {
        try {
            val name = DnsFilter.qname(q.dns)
            val prefs = getSharedPreferences(BlockPolicy.PREFS, Context.MODE_PRIVATE)
            val blockNow = name != null && BlockPolicy.isBlockingNow(this) &&
                DnsFilter.isBlocked(prefs.getStringSet(KEY_DOMAINS, emptySet()) ?: emptySet(), name)

            val reply: ByteArray = if (blockNow) {
                DnsFilter.nxdomain(q.dns)
            } else {
                forward(q.dns) ?: return // upstream timeout: drop, the client retries
            }
            val packet = DnsFilter.buildResponsePacket(q, reply)
            synchronized(output) { output.write(packet) }
        } catch (_: Exception) {
        }
    }

    private fun forward(dns: ByteArray): ByteArray? {
        val socket = DatagramSocket()
        try {
            protect(socket) // keep our own lookups out of the tunnel (no loop)
            socket.soTimeout = 3000
            socket.connect(InetSocketAddress(upstream, 53))
            socket.send(DatagramPacket(dns, dns.size))
            val resp = ByteArray(4096)
            val p = DatagramPacket(resp, resp.size)
            socket.receive(p)
            return resp.copyOf(p.length)
        } catch (_: Exception) {
            return null
        } finally {
            socket.close()
        }
    }

    private fun shutdown() {
        running = false
        isRunning = false
        try { tun?.close() } catch (_: Exception) {}
        tun = null
        pool?.shutdownNow()
        pool = null
    }

    override fun onRevoke() { // user switched to another VPN or turned this one off
        shutdown()
        stopSelf()
    }

    override fun onDestroy() {
        shutdown()
        super.onDestroy()
    }
}
