import { NextResponse } from "next/server";
import MY_TOKEN_KEY from "@/lib/get-cookie-name";

export async function POST() {
  const cookieName = MY_TOKEN_KEY();
  const isProduction = process.env.NODE_ENV === "production";
  
  const response = NextResponse.json(
    { message: "Logged out successfully" },
    { status: 200 }
  );
  
  // Clear the HTTP-only cookie
  const cookieOptions = [
    `${cookieName}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    ...(isProduction ? ["Secure", "SameSite=None"] : ["SameSite=Lax"])
  ].join("; ");
  
  response.headers.set("Set-Cookie", cookieOptions);
  
  return response;
}
