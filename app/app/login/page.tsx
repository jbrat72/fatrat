'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { APP_VERSION } from '@/lib/version';

/**
 * Login screen.
 *
 * UI-only for now: there is no real backend. "Sign in with Google" enters
 * the app with the seeded demo user. Real Firebase Google auth can replace
 * `handleGoogleSignIn` later without touching the layout.
 */
export default function LoginPage() {
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);

  const handleGoogleSignIn = () => {
    if (signingIn) return;
    setSigningIn(true);
    // Brief delay so the button shows its signing-in state.
    setTimeout(() => router.push('/today'), 350);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-xs flex-col items-center">
        {/* Logo — wordmark is baked into the mark itself. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fatrat-logo.png"
          alt="FATRAT"
          width={180}
          height={180}
          className="h-44 w-44 object-contain"
        />

        {/* Version — discreet, directly below the wordmark */}
        <p className="numeric mt-2 text-xs tracking-wide text-ink-mute">
          v{APP_VERSION}
        </p>

        <p className="mt-8 text-center text-sm text-ink-dim">
          Evidence-based strength training, your way.
        </p>

        {/* Sign in with Google */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={signingIn}
          className="mt-8 inline-flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-white px-6 text-sm font-semibold text-[#3c4043] shadow-sm transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
        >
          <GoogleMark />
          {signingIn ? 'Signing in…' : 'Sign in with Google'}
        </button>

        <p className="mt-6 text-center text-xs text-ink-mute">
          A private app — sign-in is for you, friends, and family.
        </p>
      </div>
    </main>
  );
}

/** Official multi-color Google "G" mark. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
