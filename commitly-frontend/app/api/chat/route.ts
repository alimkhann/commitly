import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, ...rest } = body;

    // Get the backend URL from environment
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
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
        "Connection": "keep-alive",
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
