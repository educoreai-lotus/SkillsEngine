import { redirectToAuthLogin } from '@/lib/authRedirect';

const AUTH_STORAGE_KEYS = ['auth_token', 'authToken', 'userId', 'tenant_id'];

export function getNAuthBaseUrl() {
  const value = process.env.NEXT_PUBLIC_NAUTH_BASE_URL || '';
  if (!value) {
    console.error(
      '[Logout Debug] Missing nAuth base URL env. Expected NEXT_PUBLIC_NAUTH_BASE_URL.'
    );
    return '';
  }
  return value.replace(/\/+$/, '');
}

export function getNAuthFrontendUrl() {
  const value =
    process.env.NEXT_PUBLIC_NAUTH_FRONTEND_URL ||
    process.env.NEXT_PUBLIC_AUTH_LOGIN_URL ||
    '';
  if (!value) {
    console.error(
      '[Logout Debug] Missing nAuth frontend URL env. Expected NEXT_PUBLIC_NAUTH_FRONTEND_URL or NEXT_PUBLIC_AUTH_LOGIN_URL.'
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
  console.log('[Logout Debug] calling nAuth logout', { logoutUrl });
  try {
    const response = await fetch(logoutUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    console.log('[Logout Debug] nAuth logout response', {
      status: response.status,
      ok: response.ok,
      logoutUrl
    });
  } catch (error) {
    console.warn('[Logout Debug] nAuth logout request threw', {
      message: error?.message || 'Unknown logout request error',
      logoutUrl
    });
    throw error;
  }
}

export function clearLocalAuthState() {
  if (typeof window === 'undefined') return;

  AUTH_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });
}

export async function logout(options = {}) {
  console.log('[Logout Debug] Logout started', {
    NEXT_PUBLIC_NAUTH_BASE_URL: Boolean(process.env.NEXT_PUBLIC_NAUTH_BASE_URL),
    NEXT_PUBLIC_NAUTH_FRONTEND_URL: process.env.NEXT_PUBLIC_NAUTH_FRONTEND_URL || '',
  });
  const shouldRedirect = options.redirect !== false;
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem('logout_in_progress', 'true');
  }

  try {
    await callNAuthLogout();
  } catch (error) {
    console.warn('[Logout Debug] nAuth logout request failed, continuing with local logout', {
      message: error?.message || 'Unknown logout error',
    });
  } finally {
    clearLocalAuthState();

    if (shouldRedirect && typeof window !== 'undefined') {
      const frontendUrl = getNAuthFrontendUrl();
      console.log('[Logout Debug] redirect decision', {
        shouldRedirect,
        hasWindow: typeof window !== 'undefined',
        frontendUrl,
      });
      if (frontendUrl) {
        console.log('[Logout Debug] redirecting to', `${frontendUrl}/login`);
        window.location.href = `${frontendUrl}/login`;
      } else {
        // Fall back to existing auth-login redirect helper when nAuth frontend URL is not configured.
        console.log('[Logout Debug] using fallback redirectToAuthLogin');
        redirectToAuthLogin();
      }
    } else if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('logout_in_progress');
    }
  }
}

