import { redirectToAuthLogin } from '@/lib/authRedirect';

const AUTH_STORAGE_KEYS = ['auth_token', 'userId', 'tenant_id'];

function readEnv(primaryKey, secondaryKey) {
  if (typeof process === 'undefined' || !process.env) {
    return '';
  }
  return process.env[primaryKey] || process.env[secondaryKey] || '';
}

export function getNAuthBaseUrl() {
  const value = readEnv('NEXT_PUBLIC_NAUTH_BASE_URL', 'VITE_NAUTH_BASE_URL');
  if (!value) {
    console.error(
      '[Logout Debug] Missing nAuth base URL env. Expected NEXT_PUBLIC_NAUTH_BASE_URL (or VITE_NAUTH_BASE_URL).'
    );
    return '';
  }
  return value.replace(/\/+$/, '');
}

export function getNAuthFrontendUrl() {
  const value = readEnv('NEXT_PUBLIC_NAUTH_FRONTEND_URL', 'VITE_NAUTH_FRONTEND_URL');
  if (!value) {
    console.error(
      '[Logout Debug] Missing nAuth frontend URL env. Expected NEXT_PUBLIC_NAUTH_FRONTEND_URL (or VITE_NAUTH_FRONTEND_URL).'
    );
    return '';
  }
  return value.replace(/\/+$/, '');
}

export async function callNAuthLogout() {
  const baseUrl = getNAuthBaseUrl();
  if (!baseUrl) {
    return;
  }

  const logoutUrl = `${baseUrl}/auth/logout`;
  await fetch(logoutUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
}

export function clearLocalAuthState() {
  if (typeof window === 'undefined') return;

  AUTH_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });
}

export async function logout(options = {}) {
  console.log('[Logout Debug] Logout started');
  const shouldRedirect = options.redirect !== false;

  try {
    await callNAuthLogout();
  } catch (error) {
    console.warn('[Logout Debug] nAuth logout request failed, continuing with local logout', {
      message: error?.message || 'Unknown logout error',
    });
  } finally {
    clearLocalAuthState();

    if (!shouldRedirect || typeof window === 'undefined') {
      return;
    }

    const frontendUrl = getNAuthFrontendUrl();
    if (frontendUrl) {
      window.location.href = `${frontendUrl}/login`;
      return;
    }

    // Fall back to existing auth-login redirect helper when nAuth frontend URL is not configured.
    redirectToAuthLogin();
  }
}

