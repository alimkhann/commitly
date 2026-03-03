import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const backendBase = process.env.NEXT_PUBLIC_EDGE_API_BASE_URL;

async function forward(req: NextRequest) {
  if (!backendBase) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_EDGE_API_BASE_URL" },
      { status: 500 }
    );
  }
  const url = new URL(req.url);
  const search = url.search ? url.search : "";
  const target = `${backendBase}/api/v1/roadmap/chat/history${search}`;

  const method = req.method;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const auth = req.headers.get("authorization");
  if (auth) headers.Authorization = auth;

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };

  if (method !== "GET") {
    const body = await req.text();
    init.body = body;
  }

  const res = await fetch(target, init);
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text || res.statusText }, { status: res.status });
  }

  if (method === "GET") {
    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function GET(req: NextRequest) {
  return forward(req);
}

export async function POST(req: NextRequest) {
  return forward(req);
}
