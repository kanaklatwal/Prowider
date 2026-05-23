'use client';
// app/dashboard/page.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from '@/components/Navbar';

interface LeadAssignment {
  assignedAt: string;
  lead: {
    id: number;
    name: string;
    phone: string;
    city: string;
    description: string;
    service: { name: string };
  };
}

interface Provider {
  id: number;
  name: string;
  monthlyQuota: number;
  leadsReceived: number;
  leadAssignments: LeadAssignment[];
}

export default function DashboardPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [highlightedProviders, setHighlightedProviders] = useState<Set<number>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/providers');
      const data = await res.json();
      setProviders(data);
    } catch (err) {
      console.error('Failed to fetch providers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    // Connect to SSE
    const es = new EventSource('/api/sse');
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true);
    });

    es.addEventListener('new-lead', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      const assignedProviderIds: number[] = data.assignedProviderIds;
      setLastUpdate(new Date().toLocaleTimeString());

      // Re-fetch providers to get fresh data
      fetchProviders();

      // Highlight newly updated provider cards
      setHighlightedProviders(new Set(assignedProviderIds));
      setTimeout(() => setHighlightedProviders(new Set()), 3000);
    });

    es.addEventListener('quota-reset', () => {
      setLastUpdate(new Date().toLocaleTimeString());
      fetchProviders();
    });

    es.onerror = () => {
      setConnected(false);
    };

    es.onopen = () => {
      setConnected(true);
    };

    return () => {
      es.close();
    };
  }, [fetchProviders]);

  const totalLeads = providers.reduce((sum, p) => sum + p.leadsReceived, 0);
  const totalCapacity = providers.reduce((sum, p) => sum + p.monthlyQuota, 0);
  const activeProviders = providers.filter((p) => p.leadsReceived > 0).length;

  function getQuotaColor(received: number, quota: number) {
    const pct = received / quota;
    if (pct >= 0.9) return 'var(--danger)';
    if (pct >= 0.6) return 'var(--warning)';
    return 'var(--accent)';
  }

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h1 className="page-title">Provider Dashboard</h1>
              <p className="page-subtitle">// Real-time lead distribution overview</p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className={connected ? 'live-dot' : ''} style={!connected ? { width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' } : {}} />
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: connected ? 'var(--success)' : 'var(--danger)' }}>
                {connected ? 'LIVE' : 'DISCONNECTED'}
              </span>
              {lastUpdate && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  · updated {lastUpdate}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-chip">
            <span className="stat-value">{providers.length}</span>
            <span className="stat-label">Providers</span>
          </div>
          <div className="stat-chip">
            <span className="stat-value">{totalLeads}</span>
            <span className="stat-label">Total Leads</span>
          </div>
          <div className="stat-chip">
            <span className="stat-value">{activeProviders}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat-chip">
            <span className="stat-value">{totalCapacity - totalLeads}</span>
            <span className="stat-label">Remaining Capacity</span>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Loading providers...
          </div>
        ) : (
          <div className="providers-grid">
            {providers.map((provider) => {
              const pct = Math.round((provider.leadsReceived / provider.monthlyQuota) * 100);
              const remaining = provider.monthlyQuota - provider.leadsReceived;
              const isHighlighted = highlightedProviders.has(provider.id);

              return (
                <div
                  key={provider.id}
                  className={`provider-card ${isHighlighted ? 'highlight' : ''}`}
                >
                  <div className="provider-header">
                    <span className="provider-name">{provider.name}</span>
                    <span className={`badge ${remaining === 0 ? 'badge-danger' : remaining <= 3 ? 'badge-warning' : 'badge-success'}`}>
                      {remaining === 0 ? 'FULL' : `${remaining} left`}
                    </span>
                  </div>

                  <div className="quota-bar-wrap">
                    <div className="quota-label">
                      <span>Quota usage</span>
                      <span>{provider.leadsReceived} / {provider.monthlyQuota}</span>
                    </div>
                    <div className="quota-bar">
                      <div
                        className="quota-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: getQuotaColor(provider.leadsReceived, provider.monthlyQuota),
                        }}
                      />
                    </div>
                  </div>

                  {provider.leadAssignments.length > 0 ? (
                    <>
                      <div className="section-heading" style={{ marginTop: '0.75rem' }}>
                        Assigned Leads ({provider.leadAssignments.length})
                      </div>
                      <div className="leads-list">
                        {provider.leadAssignments.map((a) => (
                          <div className="lead-item" key={a.lead.id}>
                            <div>
                              <div className="lead-name">{a.lead.name}</div>
                              <div className="lead-city">{a.lead.city} · {a.lead.service.name}</div>
                            </div>
                            <span className="badge badge-accent">#{a.lead.id}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', marginTop: '0.5rem' }}>
                      No leads assigned yet
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
