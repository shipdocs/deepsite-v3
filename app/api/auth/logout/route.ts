import { NextRequest, NextResponse } from "next/server";
import MY_TOKEN_KEY from "@/lib/get-cookie-name";

export async function POST(req: NextRequest) {
  const cookieName = MY_TOKEN_KEY();
  const host = req.headers.get("host") ?? "localhost:3000";
  const isSecure = !host.includes("localhost");
  
  const response = NextResponse.json(
    { message: "Logged out successfully" },
    { status: 200 }
  );
  
  // Clear the cookie (matching the same settings as login)
  const cookieOptions = [
    `${cookieName}=`,
    "Max-Age=0",
    "Path=/",
    "SameSite=Lax",
    ...(isSecure ? ["Secure"] : [])
  ].join("; ");
  
  response.headers.set("Set-Cookie", cookieOptions);
  
  return response;
}
