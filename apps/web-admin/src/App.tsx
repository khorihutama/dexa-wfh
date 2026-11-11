import React, { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
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

interface AdminToast {
  id: string;
  title: string;
  message: string;
  timestamp: string;
}

const DEFAULT_GATEWAY_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_GATEWAY_URL ??
  'http://localhost:3000';

export const App: React.FC = () => {
  const [gatewayUrl] = useState(DEFAULT_GATEWAY_URL);
  const [health, setHealth] = useState<AllHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [pingMessage, setPingMessage] = useState('Sample HRD Ping from Web Admin');
  const [socketConnected, setSocketConnected] = useState(false);
  const [toasts, setToasts] = useState<AdminToast[]>([]);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/health/all`);
      if (res.ok) {
        const data = (await res.json()) as AllHealthResponse;
        setHealth(data);
      }
    } catch {
      // handled in UI state
    } finally {
      setLoading(false);
    }
  }, [gatewayUrl]);

  useEffect(() => {
    void fetchHealth();
    const socket = io(gatewayUrl, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('admin.notification', (payload: AdminToast) => {
      setToasts((prev) => [payload, ...prev.slice(0, 4)]);
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchHealth, gatewayUrl]);

  const sendPingEvent = async () => {
    await fetch(`${gatewayUrl.replace(/\/$/, '')}/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: pingMessage }),
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
                HRD Admin Portal (:5174)
              </span>
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                  socketConnected
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                Socket.IO: {socketConnected ? 'Connected' : 'Connecting...'}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              Dexa Group — HRD Monitoring & Control
            </h1>
            <p className="text-sm text-slate-600">
              Real-Time Socket.IO Notifications, RabbitMQ Event Dispatch, and Service Health
            </p>
          </div>
          <Button onClick={() => void fetchHealth()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh /health/all'}
          </Button>
        </header>

        {toasts.length > 0 ? (
          <div className="space-y-2">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                role="status"
                className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950 shadow-sm"
              >
                <div>
                  <span className="font-semibold">{toast.title}: </span>
                  <span>{toast.message}</span>
                </div>
                <span className="text-xs text-indigo-600">
                  {new Date(toast.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <Card
          title="RabbitMQ & Socket.IO Event Test"
          subtitle="Dispatch a ping event from API Gateway -> RabbitMQ -> Log Service -> MongoDB & Socket.IO toast"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                id="ping-message"
                label="Event Payload Message"
                value={pingMessage}
                onChange={(e) => setPingMessage(e.target.value)}
              />
            </div>
            <Button variant="primary" onClick={() => void sendPingEvent()}>
              Send Ping Event
            </Button>
          </div>
        </Card>

        {health ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[health.gateway, ...Object.values(health.services)].map((svc) => (
              <Card
                key={svc.service}
                title={svc.service}
                subtitle="Microservice Status"
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
                  <p className="text-xs text-slate-500">{svc.error ?? 'Healthy'}</p>
                )}
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};
