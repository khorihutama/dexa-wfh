import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input } from '@dexa-wfh/ui';

interface ServiceHealth {
  service: string;
  status: 'ok' | 'degraded' | 'down';
  timestamp?: string;
  uptime?: number;
  error?: string;
  dependencies?: Record<string, { status: 'up' | 'down'; message?: string }>;
}

interface AllHealthResponse {
  gateway: ServiceHealth;
  services: Record<string, ServiceHealth>;
  overallStatus: 'ok' | 'degraded' | 'down';
  timestamp: string;
}

const DEFAULT_GATEWAY_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_GATEWAY_URL ??
  'http://localhost:3000';

export const App: React.FC = () => {
  const [gatewayUrl, setGatewayUrl] = useState(DEFAULT_GATEWAY_URL);
  const [health, setHealth] = useState<AllHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/health/all`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as AllHealthResponse;
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to API Gateway');
    } finally {
      setLoading(false);
    }
  }, [gatewayUrl]);

  useEffect(() => {
    void fetchHealth();
  }, [fetchHealth]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
              Employee Portal (:5173)
            </span>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              Dexa Group — WFH Attendance System
            </h1>
            <p className="text-sm text-slate-600">
              Stage 1 Monorepo Boilerplate — Microservices Health Verification
            </p>
          </div>
          <Button onClick={() => void fetchHealth()} disabled={loading}>
            {loading ? 'Checking...' : 'Refresh Health'}
          </Button>
        </header>

        <Card title="Gateway Connection" subtitle="Configure API Gateway endpoint for health check">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                id="gateway-url"
                label="API Gateway URL"
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                placeholder="http://localhost:3000"
              />
            </div>
            <Button variant="secondary" onClick={() => void fetchHealth()} disabled={loading}>
              Check /health/all
            </Button>
          </div>
          {error ? (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
              Connection Error: {error}
            </p>
          ) : null}
        </Card>

        {health ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[health.gateway, ...Object.values(health.services)].map((svc) => (
              <Card
                key={svc.service}
                title={svc.service}
                subtitle={svc.timestamp ? `Checked: ${new Date(svc.timestamp).toLocaleTimeString()}` : 'Microservice'}
                badge={
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                      svc.status === 'ok'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {svc.status}
                  </span>
                }
              >
                {svc.dependencies ? (
                  <ul className="space-y-1 text-xs text-slate-600">
                    {Object.entries(svc.dependencies).map(([dep, info]) => (
                      <li key={dep} className="flex items-center justify-between">
                        <span className="font-medium capitalize">{dep}</span>
                        <span
                          className={
                            info.status === 'up' ? 'text-emerald-600 font-semibold' : 'text-red-600'
                          }
                        >
                          {info.status.toUpperCase()}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">{svc.error ?? 'Service active'}</p>
                )}
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};
