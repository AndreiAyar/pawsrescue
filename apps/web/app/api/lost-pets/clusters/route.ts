import { NextResponse } from "next/server";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3015";

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  const url = `${apiBase.replace(/\/$/, "")}/lost-pets/clusters${search}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Proxy request failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
