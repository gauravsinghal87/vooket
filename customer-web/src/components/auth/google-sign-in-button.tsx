import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

type CredentialResponse = { credential?: string };

interface GoogleError {
  type?: string;
  message?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: CredentialResponse) => void;
            error_callback?: (error: GoogleError) => void;
            ux_mode?: 'popup' | 'redirect';
            context?: 'signin' | 'signup' | 'signinup';
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

let gisPromise: Promise<void> | null = null;

/**
 * Load Google's Identity Services library once per page. Google's script
 * provides the officially branded button and owns the account chooser popup,
 * so the app never draws its own Google logo.
 */
function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;

  gisPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () =>
      window.google ? resolve() : reject(new Error('Google Identity Services unavailable.'));
    script.onerror = () => {
      gisPromise = null;
      reject(new Error('Google Identity Services unavailable.'));
    };
    document.head.appendChild(script);
  });

  return gisPromise;
}

/**
 * Translate Google's error codes into customer-friendly wording without
 * leaking any server or token detail.
 */
function describeGoogleError(error: GoogleError): string {
  switch (error.type) {
    case 'popup_closed_by_user':
      return 'Google sign-in was cancelled.';
    case 'access_denied':
      return 'Google sign-in was declined.';
    case 'invalid_client':
    case 'missing_client_id':
      return 'Google sign-in is not set up correctly yet. Please contact support.';
    case 'network':
      return 'Could not reach Google. Check your connection and try again.';
    default:
      return 'Google sign-in could not be completed. Please try again.';
  }
}

interface GoogleSignInButtonProps {
  clientId: string;
  /** Receives the Google ID token, which the backend verifies server-side. */
  onCredential: (credential: string) => void | Promise<void>;
  text?: 'signin' | 'signup' | 'continue';
  context?: 'signin' | 'signup' | 'signinup';
  disabled?: boolean;
  onError?: (message: string) => void;
  className?: string;
}

export function GoogleSignInButton({
  clientId,
  onCredential,
  text = 'continue',
  context = 'signin',
  disabled = false,
  onError,
  className,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const errorRef = useRef(onError);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  callbackRef.current = onCredential;
  errorRef.current = onError;

  useEffect(() => {
    let cancelled = false;

    loadGis()
      .then(() => {
        const parent = containerRef.current;
        if (cancelled || !window.google || !parent) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          context,
          callback: (response) => {
            if (response.credential) void callbackRef.current(response.credential);
          },
          error_callback: (error) => {
            errorRef.current?.(describeGoogleError(error));
          },
        });

        parent.replaceChildren();
        window.google.accounts.id.renderButton(parent, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'pill',
          width: Math.max(240, parent.clientWidth || 320),
          logo_alignment: 'left',
        });

        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        errorRef.current?.('Could not load Google sign-in. Check your connection and try again.');
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, context, text]);

  if (failed) {
    return (
      <p className={cn('w-full text-center text-xs text-neutral-500', className)}>
        Google sign-in is unavailable right now. Please use email, phone, or try again later.
      </p>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="relative min-h-11">
        <div
          ref={containerRef}
          className={cn(
            'flex min-h-11 w-full justify-center overflow-hidden',
            (!ready || disabled) && 'invisible'
          )}
          aria-hidden={disabled || undefined}
        />
        {(!ready || disabled) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-500">
            {disabled ? (
              'Continue with Google'
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Continue with Google
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function GoogleSignInDivider({ className, label = 'or' }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="h-px flex-1 bg-neutral-200" />
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</span>
      <span className="h-px flex-1 bg-neutral-200" />
    </div>
  );
}
