import { useCallback, useState } from 'react';

/**
 * The shared admin password, held for the life of the browser tab.
 *
 * `sessionStorage`, not `localStorage`: a shared password on a shared machine
 * should not outlive the tab it was typed into. It is only ever a transport
 * convenience — the server is what actually validates it, so nothing here is
 * a security control.
 */
const STORAGE_KEY = 'blindbox.adminPassword';

export const ADMIN_PASSWORD_HEADER = 'X-Admin-Password';

function read(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Private windows and blocked site data both throw here.
    return null;
  }
}

export function useAdminPassword() {
  const [password, setPassword] = useState<string | null>(read);

  const remember = useCallback((value: string) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Not fatal — the value still works for this render.
    }
    setPassword(value);
  }, []);

  const forget = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setPassword(null);
  }, []);

  return { password, remember, forget };
}

/** Header to attach to a write request, or nothing when no password is held. */
export function adminHeaders(password: string | null): Record<string, string> {
  return password ? { [ADMIN_PASSWORD_HEADER]: password } : {};
}
