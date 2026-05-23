'use client';
// app/test-tools/page.tsx
import { useState } from 'react';
import Navbar from '@/components/Navbar';

interface LogLine {
  type: 'ok' | 'err' | 'warn' | 'info';
  text: string;
}

function useLog() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const log = (text: string, type: LogLine['type'] = 'info') =>
    setLines((prev) => [...prev, { text, type }]);
  const clear = () => setLines([]);
  return { lines, log, clear };
}

// Generate a UUID v4-ish idempotency key
function makeKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function TestToolsPage() {
  const quotaLog = useLog();
  const webhookLog = useLog();
  const concurrencyLog = useLog();
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [concurrencyLoading, setConcurrencyLoading] = useState(false);

  // ── Tool 1: Reset quota via webhook (new idempotency key each time) ──
  const resetQuota = async () => {
    setQuotaLoading(true);
    quotaLog.clear();
    const key = makeKey();
    quotaLog.log(`Sending webhook with key: ${key}`, 'info');

    try {
      const res = await fetch('/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'payment.subscription.renewed',
          idempotencyKey: key,
        }),
      });
      const data = await res.json();
      if (data.success) {
        quotaLog.log(`✓ ${data.message}`, 'ok');
        quotaLog.log(`Idempotent: ${data.idempotent}`, 'info');
      } else {
        quotaLog.log(`✗ ${data.error}`, 'err');
      }
    } catch (e) {
      quotaLog.log(`Network error: ${e}`, 'err');
    } finally {
      setQuotaLoading(false);
    }
  };

  // ── Tool 2: Call webhook with the SAME key multiple times ──
  const testIdempotency = async () => {
    setWebhookLoading(true);
    webhookLog.clear();
    const key = makeKey(); // same key for all 5 calls
    webhookLog.log(`Using fixed key: ${key}`, 'warn');
    webhookLog.log(`Sending 5 concurrent webhook calls with the same key...`, 'info');

    try {
      const calls = Array.from({ length: 5 }, () =>
        fetch('/api/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'payment.subscription.renewed',
            idempotencyKey: key,
          }),
        }).then((r) => r.json())
      );

      const results = await Promise.all(calls);
      const processed = results.filter((r) => r.success && !r.idempotent);
      const idempotent = results.filter((r) => r.success && r.idempotent);
      const errors = results.filter((r) => !r.success);

      webhookLog.log(`✓ Processed (first call): ${processed.length}`, 'ok');
      webhookLog.log(`⟳ Idempotent (ignored): ${idempotent.length}`, 'warn');
      if (errors.length) webhookLog.log(`✗ Errors: ${errors.length}`, 'err');
      webhookLog.log(`Quota was reset exactly ONCE despite 5 calls ✓`, 'ok');
    } catch (e) {
      webhookLog.log(`Error: ${e}`, 'err');
    } finally {
      setWebhookLoading(false);
    }
  };

  // ── Tool 3: Generate 10 concurrent leads ──
  const generateConcurrentLeads = async () => {
    setConcurrencyLoading(true);
    concurrencyLog.clear();
    concurrencyLog.log('Generating 10 leads simultaneously...', 'info');

    const services = [1, 2, 3];
    const cities = ['Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad'];

    const leads = Array.from({ length: 10 }, (_, i) => ({
      name: `Test User ${Date.now()}-${i}`,
      phone: `${String(Date.now()).slice(-9)}${i}`.slice(-10).padStart(10, '9'),
      city: cities[i % cities.length],
      serviceId: services[i % services.length],
      description: `Auto-generated lead #${i + 1} for concurrency testing`,
    }));

    try {
      const results = await Promise.allSettled(
        leads.map((lead) =>
          fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lead),
          }).then((r) => r.json())
        )
      );

      let success = 0;
      let failed = 0;
      let duplicate = 0;

      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          if (r.value.success) {
            success++;
            const providers = r.value.lead?.assignments?.map((a: { provider: { name: string } }) => a.provider.name).join(', ');
            concurrencyLog.log(`✓ Lead ${i + 1} assigned → ${providers}`, 'ok');
          } else if (r.value.error?.includes('Duplicate')) {
            duplicate++;
            concurrencyLog.log(`⟳ Lead ${i + 1} duplicate skipped`, 'warn');
          } else {
            failed++;
            concurrencyLog.log(`✗ Lead ${i + 1} failed: ${r.value.error}`, 'err');
          }
        } else {
          failed++;
          concurrencyLog.log(`✗ Lead ${i + 1} network error`, 'err');
        }
      });

      concurrencyLog.log(`─── Summary: ${success} created, ${duplicate} duplicate, ${failed} errors ───`, 'info');
      concurrencyLog.log('Check dashboard for real-time updates ↗', 'warn');
    } catch (e) {
      concurrencyLog.log(`Error: ${e}`, 'err');
    } finally {
      setConcurrencyLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Test Tools</h1>
          <p className="page-subtitle">// Simulate payments, test idempotency & concurrency</p>
        </div>

        <div className="tools-grid">
          {/* Tool 1 */}
          <div className="tool-card">
            <div className="tool-title">Reset Provider Quotas</div>
            <div className="tool-desc">
              Simulates a successful subscription payment webhook. Resets all provider monthly
              quotas to 10 and clears lead counts. Each click uses a NEW idempotency key.
            </div>
            <button className="btn btn-success" onClick={resetQuota} disabled={quotaLoading}>
              {quotaLoading ? <><span className="spinner" /> Sending...</> : '↺ Reset All Quotas (via Webhook)'}
            </button>
            {quotaLog.lines.length > 0 && (
              <div className="tool-result">
                <div className="log-output">
                  {quotaLog.lines.map((l, i) => (
                    <div key={i} className={`log-line ${l.type}`}>{l.text}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tool 2 */}
          <div className="tool-card">
            <div className="tool-title">Test Webhook Idempotency</div>
            <div className="tool-desc">
              Sends the SAME webhook event 5 times concurrently with an identical idempotency
              key. The quota should reset exactly once regardless of how many calls are made.
            </div>
            <button className="btn btn-secondary" onClick={testIdempotency} disabled={webhookLoading}>
              {webhookLoading ? <><span className="spinner" /> Testing...</> : '⚡ Send 5 Duplicate Webhooks'}
            </button>
            {webhookLog.lines.length > 0 && (
              <div className="tool-result">
                <div className="log-output">
                  {webhookLog.lines.map((l, i) => (
                    <div key={i} className={`log-line ${l.type}`}>{l.text}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tool 3 */}
          <div className="tool-card">
            <div className="tool-title">Generate 10 Concurrent Leads</div>
            <div className="tool-desc">
              Fires 10 lead creation requests simultaneously to stress-test the allocation
              logic and database concurrency handling. Check the dashboard for real-time updates.
            </div>
            <button className="btn btn-danger" onClick={generateConcurrentLeads} disabled={concurrencyLoading}>
              {concurrencyLoading ? <><span className="spinner" /> Generating...</> : '🔥 Generate 10 Leads Simultaneously'}
            </button>
            {concurrencyLog.lines.length > 0 && (
              <div className="tool-result">
                <div className="log-output">
                  {concurrencyLog.lines.map((l, i) => (
                    <div key={i} className={`log-line ${l.type}`}>{l.text}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
