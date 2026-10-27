import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const CODE_PARAM = 'impersonation_code';

/**
 * Consumes the one-time code an admin hands over in the URL and establishes the
 * vendor session.
 *
 * The code is stripped from the address bar immediately, before any request, so
 * it is not left sitting in browser history or in a Referer header if the admin
 * clicks a link inside the vendor panel.
 */
export function ImpersonationHandoff() {
  const acceptImpersonation = useAuthStore((s) => s.acceptImpersonation);
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get(CODE_PARAM);
    if (!code) return;

    started.current = true;
    params.delete(CODE_PARAM);
    const cleaned = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (cleaned ? `?${cleaned}` : ''));

    acceptImpersonation(code)
      .then(() => navigate('/', { replace: true }))
      .catch(() => {
        setError('This vendor session link is invalid or has expired. Ask the administrator to start a new one.');
        started.current = false;
      });
  }, [acceptImpersonation, navigate]);

  if (!error) return null;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-6 text-center shadow-card">
        <TriangleAlert className="mx-auto h-8 w-8 text-amber-500" />
        <h1 className="mt-3 text-base font-bold text-neutral-900">Vendor session could not start</h1>
        <p className="mt-2 text-sm text-neutral-600">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Go to vendor login
        </button>
      </div>
    </div>
  );
}
