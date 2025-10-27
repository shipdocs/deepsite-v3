import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname;
  const isLocalDev = hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.");
  const isHuggingFace = hostname === "huggingface.co" || hostname.endsWith(".huggingface.co");
  
  console.log("[Middleware] hostname:", hostname, "isHuggingFace:", isHuggingFace, "isLocalDev:", isLocalDev);
  
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
