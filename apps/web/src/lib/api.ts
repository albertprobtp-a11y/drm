const API_BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  sessionToken?: string;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...options.headers };
  let body: BodyInit | undefined;

  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  if (options.sessionToken) {
    headers.Authorization = `Bearer ${options.sessionToken}`;
  }

  const res = await fetch(`${API_BASE}/api${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers,
    body,
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (isJson && typeof data === "object" && data?.error) || "Une erreur est survenue.";
    throw new ApiError(message, res.status, isJson ? data : undefined);
  }

  return data as T;
}

export function assetUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export const WS_BASE = import.meta.env.VITE_WS_URL ?? "";
