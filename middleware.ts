import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Get the actual hostname from headers (important for proxied environments like HF Spaces)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  const hostname = forwardedHost || host || request.nextUrl.hostname;
  
  console.log("[Middleware] x-forwarded-host:", forwardedHost, "host:", host, "hostname:", hostname);
  
  const isLocalDev = hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("localhost:") || hostname.startsWith("127.0.0.1:");
  const isHuggingFace = hostname === "huggingface.co" || hostname.endsWith(".huggingface.co");
  
  console.log("[Middleware] isHuggingFace:", isHuggingFace, "isLocalDev:", isLocalDev);
  
  if (!isHuggingFace && !isLocalDev) {
    console.log("[Middleware] Redirecting to huggingface.co");
    const canonicalUrl = new URL("https://huggingface.co/deepsite");
    canonicalUrl.pathname = request.nextUrl.pathname;
    canonicalUrl.search = request.nextUrl.search;
    return NextResponse.redirect(canonicalUrl, 301);
  }
  
  const headers = new Headers(request.headers);
  headers.set("x-current-host", request.nextUrl.host);
  
  const response = NextResponse.next({ headers });

  if (request.nextUrl.pathname.startsWith('/_next/static')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  response.headers.set('X-Canonical-URL', `https://huggingface.co/deepsite${request.nextUrl.pathname}`);
  
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
