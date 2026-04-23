/**
 * External auth redirect helper.
 * Skills Engine is not the auth provider and must redirect
 * to the platform/nAuth login entrypoint.
 */

const AUTH_LOGIN_URL = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL;
const RETURN_URL_PARAM = process.env.NEXT_PUBLIC_AUTH_RETURN_PARAM || 'return_url';

export function redirectToAuthLogin() {
  if (typeof window === 'undefined') return;

  const currentUrl = window.location.href;
  if (!AUTH_LOGIN_URL) {
    // Fail closed to app root if auth entrypoint is not configured.
    window.location.href = '/';
    return;
  }

  const separator = AUTH_LOGIN_URL.includes('?') ? '&' : '?';
  const loginUrl =
    `${AUTH_LOGIN_URL}${separator}${RETURN_URL_PARAM}=${encodeURIComponent(currentUrl)}`;
  window.location.href = loginUrl;
}
