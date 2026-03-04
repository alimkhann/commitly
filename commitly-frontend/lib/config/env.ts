const sanitize = (value?: string) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeEdgeBaseUrl = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/api\/v1$/i, "");
};

const edgeApiBaseUrl = normalizeEdgeBaseUrl(
  sanitize(process.env.NEXT_PUBLIC_EDGE_API_BASE_URL)
);

export const env = {
  apiBaseUrl: edgeApiBaseUrl,
  edgeApiBaseUrl,
  supabaseUrl: sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: sanitize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  clerkPublishableKey: sanitize(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
};

export const isBackendConfigured = () => Boolean(env.apiBaseUrl);
