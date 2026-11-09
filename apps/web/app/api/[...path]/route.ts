import { NextResponse } from "next/server";

const apiBase = process.env.API_URL ?? "http://localhost:3015";

async function proxy(request: Request, params?: { path?: string[] }) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.API_PROXY_ENABLED !== "true"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const url = new URL(request.url);
  const pathFromParams = params?.path?.join("/") ?? "";
  const pathFromUrl = url.pathname.replace(/^\/api\/?/, "");
  const path = pathFromParams || pathFromUrl;
  const target = `${apiBase.replace(/\/$/, "")}/${path}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  try {
    const res = await fetch(target, {
      method,
      headers,
      body,
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") ?? "application/json";
    const data = await res.arrayBuffer();

    return new NextResponse(data, {
      status: res.status,
      headers: {
        "content-type": contentType,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Proxy request failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, await params);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, await params);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, await params);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, await params);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, await params);
}
