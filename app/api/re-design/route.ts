import { NextRequest, NextResponse } from "next/server";

// Timeout configuration (in milliseconds)
const FETCH_TIMEOUT = 30000; // 30 seconds for external fetch

// Extend the maximum execution time for this route
export const maxDuration = 60; // 1 minute

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { url } = body;

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const response = await fetch(
        `https://r.jina.ai/${encodeURIComponent(url)}`,
        {
          method: "POST",
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return NextResponse.json(
          { error: "Failed to fetch redesign" },
          { status: 500 }
        );
      }
      const markdown = await response.text();
      return NextResponse.json(
        {
          ok: true,
          markdown,
        },
        { status: 200 }
      );
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: "Request timeout: The external service took too long to respond. Please try again." },
          { status: 504 }
        );
      }
      throw fetchError;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return NextResponse.json(
        { error: "Request timeout: The external service took too long to respond. Please try again." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: error.message || "An error occurred" },
      { status: 500 }
    );
  }
}
