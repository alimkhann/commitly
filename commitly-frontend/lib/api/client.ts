type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type NextFetchOptions = {
  revalidate?: number | false;
  tags?: string[];
};

type ApiClientOptions<TBody> = {
  path: string;
  method?: HttpMethod;
  body?: TBody;
  headers?: HeadersInit;
  authToken?: string;
  cache?: RequestCache;
  next?: NextFetchOptions;
  signal?: AbortSignal;
};

export type ApiClientResponse<TData> = {
  ok: boolean;
  status: number;
  data?: TData | null;
  error?: string;
};

const buildHeaders = (
  headers: HeadersInit | undefined,
  hasJsonBody: boolean,
  authToken?: string
): Headers => {
  const resolved = new Headers(headers);
  if (hasJsonBody && !resolved.has("Content-Type")) {
    resolved.set("Content-Type", "application/json");
  }
  if (authToken) {
    resolved.set("Authorization", `Bearer ${authToken}`);
  }
  return resolved;
};

const resolveUrl = (path: string, baseUrl: string) => {
  if (path.startsWith("http")) {
    return path;
  }
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(normalizedPath, normalizedBase).toString();
};

export async function apiClient<TResponse, TBody = unknown>(
  baseUrl: string,
  {
    path,
    method = "GET",
    body,
    headers,
    authToken,
    cache = "no-store",
    next,
    signal,
  }: ApiClientOptions<TBody>
): Promise<ApiClientResponse<TResponse>> {
  const hasJsonBody = body !== undefined;
  const requestHeaders = buildHeaders(headers, hasJsonBody, authToken);

  try {
    const response = await fetch(resolveUrl(path, baseUrl), {
      method,
      cache,
      headers: requestHeaders,
      body: hasJsonBody ? JSON.stringify(body) : undefined,
      next,
      signal,
    });

    const contentType = response.headers.get("content-type");
    const isJson = contentType?.includes("application/json");
    const payload = isJson ? await response.json().catch(() => null) : null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error:
          (payload as { message?: string })?.message ??
          response.statusText ??
          "Request failed",
      };
    }

    return {
      ok: true,
      status: response.status,
      data: payload as TResponse | null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Network request failed",
    };
  }
}
