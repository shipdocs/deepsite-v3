import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  
  // Don't redirect if on localhost
  if (hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
    return NextResponse.next();
  }
  
  // Check if user is on hf.co or huggingface.co domains
  const isHuggingFace = hostname.includes("hf.co") || hostname.includes("huggingface.co");
  
  // If not on HuggingFace domains, redirect to huggingface.co/deepsite
  if (!isHuggingFace) {
    return NextResponse.redirect("https://huggingface.co/deepsite", 301);
  }
  
  // Continue normally for HuggingFace domains
  return NextResponse.next();
}

export const config = {
  matcher: "/:path*", // Match all paths
};
