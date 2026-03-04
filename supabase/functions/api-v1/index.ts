const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret, x-worker-secret, x-admin-user",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

function extractApiPath(pathname: string) {
  const marker = "/api/v1";
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex >= 0) {
    return pathname.slice(markerIndex);
  }
  return pathname;
}

function resolveTargetFunction(path: string) {
  if (path.startsWith("/api/v1/internal/worker/")) {
    return "roadmap-worker";
  }
  if (path.startsWith("/api/v1/admin/")) {
    return "api-admin";
  }
  if (path.startsWith("/api/v1/github/")) {
    return "api-github";
  }
  if (path === "/api/v1/roadmap/chat" || path.startsWith("/api/v1/roadmap/chat/")) {
    return "api-chat";
  }
  if (path.startsWith("/api/v1/roadmap/")) {
    return "api-roadmap";
  }
  if (path === "/api/v1/waitlist" || path === "/api/v1/waitlist/count" || path.startsWith("/api/v1/feedback/")) {
    return "api-feedback";
  }
  if (path === "/api/v1/preferences" || path === "/api/v1/usage/global" || path === "/api/v1/auth/ping") {
    return "api-user";
  }
  return null;
}

function withCors(upstreamHeaders: Headers) {
  const headers = new Headers(upstreamHeaders);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return headers;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (!SUPABASE_URL) {
    return new Response(
      JSON.stringify({
        detail: "Supabase URL is not configured",
        error_code: "config_missing",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }

  const url = new URL(req.url);
  const path = normalizePath(extractApiPath(url.pathname));
  const targetFunction = resolveTargetFunction(path);

  if (!targetFunction) {
    return new Response(
      JSON.stringify({
        detail: `No route found for ${req.method} ${path}`,
        error_code: "not_found",
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }

  const targetUrl = `${SUPABASE_URL}/functions/v1/${targetFunction}${path}${url.search}`;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-commitly-gateway", "api-v1");
  if (!requestHeaders.has("apikey") && SUPABASE_ANON_KEY) {
    requestHeaders.set("apikey", SUPABASE_ANON_KEY);
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: requestHeaders,
      body: req.body,
      redirect: "manual",
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: withCors(upstream.headers),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Gateway proxy request failed";
    return new Response(
      JSON.stringify({
        detail,
        error_code: "gateway_error",
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});
