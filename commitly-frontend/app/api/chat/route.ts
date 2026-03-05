import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const normalizeEdgeBaseUrl = (value?: string | null) =>
  value ? value.trim().replace(/\/+$/, "").replace(/\/api\/v1$/i, "") : "";

export async function POST(req: NextRequest) {
  console.log("Chat API route hit");
  try {
    const body = await req.json();
    const { messages, ...rest } = body;

    const apiBaseUrl = normalizeEdgeBaseUrl(
      process.env.NEXT_PUBLIC_EDGE_API_BASE_URL
    );
    if (!apiBaseUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_EDGE_API_BASE_URL" },
        { status: 500 }
      );
    }
    const backendUrl = `${apiBaseUrl}/api/v1/roadmap/chat`;

    // Forward the request to the backend
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward the Authorization header if present
        Authorization: req.headers.get("Authorization") || "",
      },
      body: JSON.stringify({
        messages,
        ...rest,
      }),
      cache: "no-store",
      // @ts-expect-error - duplex is needed for some node environments but might not be strictly needed for edge, adding for safety if runtime changes
      duplex: "half",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend chat error:", response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Stream the response back
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Vercel-AI-Data-Stream": "v1",
      },
    });
  } catch (error) {
    console.error("Chat route error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
