'use strict';
/**
 * Full load-test suite targeting the API Gateway.
 *
 * Strategy to hit ~50 K concurrent requests:
 *   - connections: 500  (open connections at once)
 *   - pipelining:  10   (requests in-flight per connection = 5 000 concurrent)
 *   - duration:    30s  → with target RPS ~1 667 req/s × 30s ≈ 50 K total
 *
 * Adjust `connections` and `pipelining` based on your hardware.
 * For true 50 K *simultaneous* connections use connections=50000 with a
 * gateway cluster of at least 8 cores.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const autocannon = require('autocannon');

const GATEWAY = process.env.LOAD_TEST_TARGET || 'http://localhost:3000';

// ── Step 1: obtain a JWT ──────────────────────────────────────────────────────
async function getToken() {
  const http = require('http');
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email: 'loadtest@example.com', password: 'LoadTest123!' });
    const req = http.request(
      {
        hostname: 'localhost',
        port: parseInt(process.env.GATEWAY_PORT || '3000', 10),
        path: '/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let raw = '';
        res.on('data', (d) => (raw += d));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            resolve(parsed?.data?.accessToken || '');
          } catch {
            reject(new Error(`Failed to parse login response: ${raw}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function runScenario({ title, url, method = 'GET', headers = {}, body, connections, pipelining, duration }) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scenario: ${title}`);
  console.log(`  Target     : ${url}`);
  console.log(`  Connections: ${connections}`);
  console.log(`  Pipelining : ${pipelining}`);
  console.log(`  Duration   : ${duration}s`);
  console.log('='.repeat(60));

  return new Promise((resolve, reject) => {
    const instance = autocannon(
      {
        url,
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined,
        connections,
        pipelining,
        duration,
        timeout: 30,
      },
      (err, result) => {
        if (err) return reject(err);

        console.log(autocannon.printResult(result));
        console.log(`\n  ✔ Total requests  : ${result.requests.total.toLocaleString()}`);
        console.log(`  ✔ Req/sec (avg)   : ${result.requests.average.toFixed(0)}`);
        console.log(`  ✔ Latency p99     : ${result.latency.p99}ms`);
        console.log(`  ✔ Errors          : ${result.errors}`);
        resolve(result);
      },
    );
    autocannon.track(instance, { renderProgressBar: true });
  });
}

async function main() {
  console.log('🚀 Ticketing System Load Test');
  console.log(`   Target: ${GATEWAY}`);

  let token = '';
  try {
    token = await getToken();
    console.log('   JWT obtained ✓');
  } catch (err) {
    console.warn(`   WARNING: Could not get JWT (${err.message}). Auth tests will be skipped.`);
  }

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  // ── Scenario A: Health check (baseline) ──────────────────────────────────
  await runScenario({
    title: 'Health Check (no auth)',
    url: `${GATEWAY}/health`,
    connections: 1000,
    pipelining: 10,
    duration: 20,
  });

  // ── Scenario B: Login (rate-limit zone — auth stress test) ───────────────
  await runScenario({
    title: 'Login endpoint',
    url: `${GATEWAY}/auth/login`,
    method: 'POST',
    body: { email: 'loadtest@example.com', password: 'LoadTest123!' },
    connections: 200,
    pipelining: 5,
    duration: 20,
  });

  if (token) {
    // ── Scenario C: List tickets (read-heavy — cache warm) ──────────────────
    await runScenario({
      title: 'List tickets (authenticated)',
      url: `${GATEWAY}/tickets?limit=20&page=1`,
      headers: authHeader,
      connections: 500,
      pipelining: 10,
      duration: 30,
    });

    // ── Scenario D: Create tickets (write concurrency — Redlock) ────────────
    await runScenario({
      title: 'Create tickets (write concurrency)',
      url: `${GATEWAY}/tickets`,
      method: 'POST',
      headers: authHeader,
      body: {
        title: 'Load test ticket',
        description: 'Created during load test run',
        priority: 'medium',
      },
      connections: 300,
      pipelining: 5,
      duration: 30,
    });
  }

  console.log('\n✅ Load test complete.');
}

main().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
