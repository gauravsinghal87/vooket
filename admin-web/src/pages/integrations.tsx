import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlugZap, ShieldCheck, TestTube2, RefreshCw, RotateCcw, ChevronDown, Copy, Check, Info } from 'lucide-react';
import { integrationsApi } from '@/repositories/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton, ErrorState } from '@/components/ui/state';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { AdminIntegrationDetail } from '@/typings/models';

const humanize = (key: string) => key.replace(/_/g, ' ');

function CopyableValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast('Could not copy to clipboard', 'error');
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-ink-50 px-2.5 py-2 font-mono text-xs text-neutral-700">
          {value}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()} aria-label={`Copy ${label}`}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

function SmtpPanel({ data }: { data: AdminIntegrationDetail }) {
  const qc = useQueryClient();
  const [testEmail, setTestEmail] = useState('');

  const password = data.credentials?.password;
  const username = data.credentials?.username;

  const testMutation = useMutation({
    mutationFn: (email: string) => integrationsApi.sendSmtpTestEmail(email),
    onSuccess: () => {
      toast('Test email sent successfully.');
      setTestEmail('');
      void qc.invalidateQueries({ queryKey: ['admin-integration'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Test email failed', 'error'),
  });

  const status = !data.is_enabled
    ? { label: 'Disabled', tone: 'neutral' as const }
    : !data.is_configured
      ? { label: 'Not Configured', tone: 'warning' as const }
      : { label: 'Configured', tone: 'success' as const };

  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-900">SMTP / Email</p>
          <p className="text-xs text-neutral-500">Drives password reset and other transactional email</p>
        </div>
        <Badge tone={status.tone}>Status: {status.label}</Badge>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-ink-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Credentials</p>

          <dl className="mt-2 space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-neutral-500">SMTP Username</dt>
              <dd className="truncate font-mono text-xs text-neutral-700">
                {username?.configured ? username.masked ?? '••••••••' : 'Not set'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <dt className="text-neutral-500">SMTP Password</dt>
              <dd className="font-mono text-xs text-neutral-700">
                {password?.configured ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden>••••••••••</span>
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Configured
                    </span>
                  </span>
                ) : (
                  'Not set'
                )}
              </dd>
            </div>
          </dl>

          <p className="mt-2 text-[10px] text-neutral-400">
            The password is encrypted at rest and is never sent to the browser. Leave the field blank
            when editing to keep the stored password.
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
            <Info className="h-3.5 w-3.5" /> Send Test Email
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              autoComplete="off"
              placeholder="admin@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={!testEmail.trim() || testMutation.isPending}
              onClick={() => testMutation.mutate(testEmail.trim())}
            >
              {testMutation.isPending ? 'Sending…' : 'Send Test Email'}
            </Button>
          </div>
          <p className="mt-2 text-[10px] text-blue-700/80">
            Sends a real message through the configured provider. Use a Gmail app password when the
            provider requires one, rather than your normal account password.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleOAuthPanel({ data }: { data: AdminIntegrationDetail }) {
  const clientId = data.credentials?.client_id;
  const clientSecret = data.credentials?.client_secret;

  // Google sign-in is rendered by the CUSTOMER app, not this admin app. The
  // authorized JavaScript origin must therefore be the customer-web origin.
  // window.location.origin here would be the admin origin and is wrong.
  const customerOrigin = 'http://localhost:5173';
  const adminOrigin = 'http://localhost:5174';

  const status = !data.is_enabled
    ? { label: 'Disabled', tone: 'neutral' as const }
    : !data.is_configured
      ? { label: 'Not Configured', tone: 'warning' as const }
      : { label: 'Configured', tone: 'success' as const };

  const steps = [
    'Open Google Auth Platform → Clients and create a Web application credential.',
    `Add ${customerOrigin} to Authorized JavaScript origins — this is the origin the customer app is served from. Use the exact origin with no trailing slash and no path (do not add ${customerOrigin}/auth/login).`,
    'Copy the Client ID and Client Secret, then paste them below and save.',
    'Enable Google OAuth, then confirm sign-in on the customer login page.',
  ];

  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Google OAuth</p>
          <p className="text-xs text-neutral-500">Provider: {data.provider}</p>
        </div>
        <Badge tone={status.tone}>Status: {status.label}</Badge>
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        Customer sign-in uses Google Identity Services. No backend redirect URI is required — the browser
        receives a Google ID token and the backend verifies its signature before signing the customer in.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">Credentials</p>
          <ul className="space-y-1">
            <li className="flex items-center justify-between gap-3 text-sm">
              <span className="text-neutral-500">Client ID</span>
              <span className="font-mono text-xs text-neutral-700">
                {clientId?.configured ? clientId.masked ?? '••••••••' : 'Not set'}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 text-sm">
              <span className="text-neutral-500">Client Secret</span>
              <span className="font-mono text-xs text-neutral-700">
                {clientSecret?.configured ? clientSecret.masked ?? '••••••••' : 'Not set'}
              </span>
            </li>
          </ul>
          <p className="mt-2 text-[10px] text-neutral-400">
            The client secret is encrypted at rest and never returned by the API after saving.
          </p>
        </div>

        <div className="space-y-3">
          <CopyableValue label="Authorized JavaScript origin (required)" value={customerOrigin} />
          <CopyableValue label="Authorized JavaScript origin (admin, only if you render Google sign-in in admin)"
            value={adminOrigin} />
          <p className="text-[10px] text-neutral-400">
            Google sign-in runs on the customer app, so <span className="font-semibold">{customerOrigin}</span> is
            the origin that must be authorized. Add the admin origin only if Google sign-in is also rendered
            there — it is not a substitute. Authorized JavaScript origins take the origin only, with no path.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
          <Info className="h-3.5 w-3.5" /> Setup instructions
        </p>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-blue-800">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-2 text-[10px] text-blue-700/80">
          Test connection only validates the saved settings. It cannot sign in a customer on your behalf —
          use &ldquo;Continue with Google&rdquo; on the customer login page for end-to-end verification.
        </p>
      </div>
    </div>
  );
}

function GoogleMapsPanel({ data }: { data: AdminIntegrationDetail }) {
  const serverKey = data.credentials?.server_key;
  const browserKey = data.credentials?.browser_key;

  const status = !data.is_enabled
    ? { label: 'Disabled', tone: 'neutral' as const }
    : !data.is_configured
      ? { label: 'Not Configured', tone: 'warning' as const }
      : data.last_test_status === 'error'
        ? { label: 'Error', tone: 'danger' as const }
        : data.last_test_status === 'ok'
          ? { label: 'Connected', tone: 'success' as const }
          : { label: 'Ready', tone: 'info' as const };

  const apis: { label: string; enabled: boolean }[] = [
    { label: 'Maps JavaScript', enabled: true },
    { label: 'Places', enabled: true },
    { label: 'Routes', enabled: true },
    { label: 'Geocoding', enabled: true },
    { label: 'Roads', enabled: false },
  ];

  const keys = [
    { label: 'Browser Key', credential: browserKey },
    { label: 'Server Key', credential: serverKey },
  ];

  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Google Maps</p>
          <p className="text-xs text-neutral-500">Provider: {data.provider}</p>
        </div>
        <Badge tone={status.tone}>Status: {status.label}</Badge>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">Enabled APIs</p>
          <ul className="space-y-1">
            {apis.map((api) => (
              <li key={api.label} className="flex items-center gap-2 text-sm">
                <span className={cn('font-mono', api.enabled ? 'text-emerald-600' : 'text-neutral-300')}>
                  {api.enabled ? '✓' : '○'}
                </span>
                <span className={api.enabled ? 'text-neutral-700' : 'text-neutral-400'}>{api.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">Keys</p>
          <ul className="space-y-1">
            {keys.map((entry) => (
              <li key={entry.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-neutral-500">{entry.label}</span>
                <span className="font-mono text-xs text-neutral-700">
                  {entry.credential?.configured ? (entry.credential.masked ?? '••••••••') : 'Not set'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-emerald-500' : 'bg-neutral-300'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          checked ? 'left-[22px]' : 'left-0.5'
        )}
      />
    </button>
  );
}

function ServiceCard({
  service,
  onManage,
}: {
  service: { service: string; label: string; enabled: boolean; is_configured: boolean; environment: string; mode: string; from: string };
  onManage: () => void;
}) {
  return (
    <Card className="flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <PlugZap className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{service.label}</CardTitle>
              <p className="font-mono text-[11px] text-neutral-400">{service.service}</p>
            </div>
          </div>
          <Badge tone={service.enabled ? 'success' : 'neutral'}>{service.enabled ? 'Enabled' : 'Disabled'}</Badge>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={service.is_configured ? 'success' : 'warning'}>
            {service.is_configured ? 'Configured' : 'Not configured'}
          </Badge>
          <Badge tone="info">{service.environment}</Badge>
          <Badge tone="slate">{service.mode} mode</Badge>
          <Badge tone="violet">{service.from}</Badge>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onManage}>
          Manage
        </Button>
      </div>
    </Card>
  );
}

function IntegrationDetailModal({
  service,
  open,
  onOpenChange,
}: {
  service: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [showReasons, setShowReasons] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-integration', service],
    queryFn: () => integrationsApi.get(service!),
    enabled: open && !!service,
  });

  useEffect(() => {
    setDrafts({});
    setShowReasons(false);
  }, [service]);

  const saveMutation = useMutation({
    mutationFn: ({ svc, body }: { svc: string; body: Record<string, unknown> }) => integrationsApi.update(svc, body),
    onSuccess: () => {
      toast('Settings saved');
      void qc.invalidateQueries({ queryKey: ['admin-integration'] });
      void qc.invalidateQueries({ queryKey: ['admin-integrations'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Save failed', 'error'),
  });

  const testMutation = useMutation({
    mutationFn: (svc: string) => integrationsApi.test(svc),
    onSuccess: (result) => {
      toast(result?.message || 'Connection test passed');
      void refetch();
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Connection test failed', 'error');
      void refetch();
    },
  });

  const resetMutation = useMutation({
    mutationFn: (svc: string) => integrationsApi.reset(svc),
    onSuccess: () => {
      toast('Settings reset to defaults');
      void qc.invalidateQueries({ queryKey: ['admin-integration'] });
      void qc.invalidateQueries({ queryKey: ['admin-integrations'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Reset failed', 'error'),
  });

  const dirty =
    !!data &&
    (drafts.provider !== undefined ||
      drafts.environment !== undefined ||
      drafts.is_enabled !== undefined ||
      Object.entries(drafts).some(([k, v]) => k in (data.credentials ?? {}) && v !== ''));

  const handleSave = () => {
    if (!data) return;
    const body: Record<string, unknown> = {};
    if (drafts.provider !== undefined && drafts.provider !== data.provider) body.provider = drafts.provider;
    if (drafts.environment !== undefined && drafts.environment !== data.environment) body.environment = drafts.environment;
    if (drafts.is_enabled !== undefined && drafts.is_enabled !== String(data.is_enabled)) {
      body.is_enabled = drafts.is_enabled === 'true';
    }
    for (const key of Object.keys(data.credentials ?? {})) {
      const value = drafts[key]?.trim();
      if (value) body[key] = value;
    }
    saveMutation.mutate({ svc: data.service, body });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} wide title={data?.label ?? 'Integration'} description={data?.service ?? service ?? ''}>
      {isLoading ? (
        <Skeleton rows={5} />
      ) : isError || !data ? (
        <ErrorState message="Failed to load integration settings" onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={data.is_enabled ? 'success' : 'neutral'}>
              {data.is_enabled ? 'Enabled' : 'Disabled'}
            </Badge>
            <Badge tone={data.is_configured ? 'success' : 'warning'}>
              {data.is_configured ? 'Configured' : 'Not configured'}
            </Badge>
            <Badge tone="info">{data.environment}</Badge>
            <Badge tone="slate">source: {data.from}</Badge>
          </div>

          {data.service === 'maps' && <GoogleMapsPanel data={data} />}
          {data.service === 'google_oauth' && <GoogleOAuthPanel data={data} />}
          {data.service === 'smtp' && <SmtpPanel data={data} />}

          {data.is_enabled && data.reasons.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <button
                type="button"
                className="flex items-center gap-2 text-xs font-semibold text-amber-800"
                onClick={() => setShowReasons((v) => !v)}
              >
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showReasons && 'rotate-180')} />
                {data.reasons.length} reason(s) the real provider is suppressed
              </button>
              {showReasons && (
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-700">
                  {data.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Provider</label>
              <Select
                value={drafts.provider ?? data.provider}
                onChange={(e) => setDrafts((d) => ({ ...d, provider: e.target.value }))}
              >
                {data.allowed_providers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700">Environment</label>
              <Select
                value={drafts.environment ?? data.environment}
                onChange={(e) => setDrafts((d) => ({ ...d, environment: e.target.value }))}
              >
                {['test', 'live'].map((env) => (
                  <option key={env} value={env}>
                    {env}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-neutral-800">Enabled</p>
              <p className="text-xs text-neutral-400">Routes live traffic only when enabled and mode is live.</p>
            </div>
            <Toggle
              checked={drafts.is_enabled !== undefined ? drafts.is_enabled === 'true' : data.is_enabled}
              onChange={(v) => setDrafts((d) => ({ ...d, is_enabled: String(v) }))}
            />
          </div>

          <div className="space-y-4">
            {data.service === 'smtp' ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">SMTP Host</label>
                    <Input
                      autoComplete="off"
                      placeholder="smtp.gmail.com"
                      value={drafts.host ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, host: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">SMTP Port</label>
                    <Input
                      type="number"
                      min={1}
                      max={65535}
                      placeholder="587"
                      value={drafts.port ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, port: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">Encryption</label>
                    <Select
                      value={drafts.encryption ?? 'tls'}
                      onChange={(e) => setDrafts((d) => ({ ...d, encryption: e.target.value }))}
                    >
                      <option value="tls">TLS (STARTTLS, usually port 587)</option>
                      <option value="ssl">SSL (implicit TLS, usually port 465)</option>
                      <option value="none">None</option>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">SMTP Username</label>
                    <Input
                      autoComplete="off"
                      placeholder="example@gmail.com"
                      value={drafts.username ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, username: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">SMTP Password</label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder={data.credentials?.password?.configured ? '•••••••• (leave blank to keep)' : 'Not configured'}
                    value={drafts.password ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, password: e.target.value }))}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">From Email</label>
                    <Input
                      type="email"
                      autoComplete="off"
                      placeholder="no-reply@example.com"
                      value={drafts.from_email ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, from_email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">From Name</label>
                    <Input
                      autoComplete="off"
                      placeholder="My Super App"
                      value={drafts.from_name ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, from_name: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            ) : (
              Object.entries(data.credentials ?? {}).map(([key, cred]) => (
                <div key={key}>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">{humanize(key)}</label>
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder={cred.configured ? cred.masked ?? '••••••••' : 'Not configured'}
                    value={drafts[key] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                  />
                  {cred.configured && (
                    <p className="mt-1 text-[10px] text-neutral-400">Saved on this environment. Leave blank to keep.</p>
                  )}
                </div>
              ))
            )}
          </div>

          {data.last_tested_at && (
            <div className="rounded-xl bg-ink-50 p-3 text-xs text-neutral-600">
              <p className="flex items-center gap-2 font-semibold">
                <ShieldCheck className={cn('h-3.5 w-3.5', data.last_test_status === 'ok' ? 'text-emerald-500' : 'text-red-500')} />
                Last test: {data.last_test_status === 'ok' ? 'passed' : 'failed'} · {new Date(data.last_tested_at).toLocaleString()}
              </p>
              {data.last_test_message && <p className="mt-1 text-neutral-500">{data.last_test_message}</p>}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 pt-4">
            <Button
              variant="ghost"
              size="sm"
              disabled={resetMutation.isPending}
              onClick={() => {
                if (window.confirm(`Reset ${data.label} settings to defaults?`)) resetMutation.mutate(data.service);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {resetMutation.isPending ? 'Resetting…' : 'Reset'}
            </Button>
            {/*
              For SMTP the /test route is "send a test email", which requires a
              recipient. A body-less "Test connection" call would fail
              validation, so the dedicated Send Test Email control in the
              SmtpPanel is the only test action for this service.
            */}
            {data.service !== 'smtp' && (
              <Button
                variant="outline"
                size="sm"
                disabled={testMutation.isPending}
                onClick={() => testMutation.mutate(data.service)}
              >
                <TestTube2 className="h-3.5 w-3.5" />
                {testMutation.isPending ? 'Testing…' : 'Test connection'}
              </Button>
            )}
            <Button size="sm" disabled={!dirty || saveMutation.isPending} onClick={handleSave}>
              {saveMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function IntegrationsPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-integrations'],
    queryFn: () => integrationsApi.list(),
  });

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Third-party service settings (maps, payments, SMS, media, realtime)"
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="py-6" />
      ) : isError ? (
        <ErrorState message="Failed to load integrations" onRetry={() => void refetch()} />
      ) : data && data.length === 0 ? (
        <ErrorState message="No integrations configured" />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data?.map((svc) => (
            <ServiceCard
              key={svc.service}
              service={{
                service: svc.service,
                label: svc.label,
                enabled: svc.enabled,
                is_configured: svc.is_configured,
                environment: svc.environment,
                mode: svc.mode,
                from: svc.from,
              }}
              onManage={() => setSelected(svc.service)}
            />
          ))}
        </div>
      )}

      <IntegrationDetailModal
        service={selected}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}