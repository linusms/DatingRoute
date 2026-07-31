export async function register() {
  // Only execute node:dns configuration when running in Node.js server runtime (prevents Edge runtime errors)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const dns = await import('node:dns');
    if (typeof dns.setDefaultResultOrder === 'function') {
      dns.setDefaultResultOrder('ipv4first');
    }
  }
}
