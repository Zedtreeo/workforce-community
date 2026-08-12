function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'demo.zedtreeo.io') return 'https://api-demo.zedtreeo.io/api/v1';
    if (hostname === 'hrms.zedtreeo.io') return 'https://api-hrms.zedtreeo.io/api/v1';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
}

export const API_BASE = getApiBase();

type FetchOptions = RequestInit & {
  token?: string;
};

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { token, headers, ...rest } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    credentials: 'include',
    ...rest,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    notifyDemoReadOnly(error);
    throw new Error(error.message || `API error: ${res.status}`);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/**
 * When a write is blocked on the read-only demo, the API responds with
 * `code: 'DEMO_READ_ONLY'`. apiFetch isn't a React hook, so it broadcasts a
 * window event that <DemoReadOnlyToast> turns into a friendly toast.
 */
function notifyDemoReadOnly(error: any): void {
  if (typeof window !== 'undefined' && error?.code === 'DEMO_READ_ONLY') {
    window.dispatchEvent(
      new CustomEvent('demo-readonly', { detail: String(error.message ?? '') }),
    );
  }
}


// Append this to apps/web/src/lib/api.ts
//
// Helper for multipart/form-data uploads (CSV importer, file upload endpoints).
// The default apiFetch hard-codes Content-Type: application/json which breaks
// multipart — this helper omits that header so the browser can set the
// correct multipart/form-data; boundary=... header automatically.


export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options: { token?: string } = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers: {
      ...(options.token && { Authorization: `Bearer ${options.token}` }),
      // DO NOT set Content-Type — browser sets multipart boundary
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    notifyDemoReadOnly(err);
    throw new Error(err.message || `Upload failed: ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
