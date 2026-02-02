import { User } from "@/types";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import MY_TOKEN_KEY from "./get-cookie-name";

// UserResponse = type User & { token: string };
type UserResponse = User & { token: string };

export const isAuthenticated = async (): // req: NextRequest
Promise<UserResponse | NextResponse<unknown> | undefined> => {
  if (process.env.SKIP_AUTH === "true") {
    return {
      id: "local-user",
      name: "Local User",
      username: "local",
      email: "local@example.com",
      avatarUrl: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y",
      token: "local-token",
    } as unknown as UserResponse; // cast to avoid type errors with missing props if any
  }

  const authHeaders = await headers();
  const cookieStore = await cookies();
  const token = cookieStore.get(MY_TOKEN_KEY())?.value
    ? `Bearer ${cookieStore.get(MY_TOKEN_KEY())?.value}`
    : authHeaders.get("Authorization");

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message: "Wrong castle fam :(",
      },
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  const user = await fetch("https://huggingface.co/api/whoami-v2", {
    headers: {
      Authorization: token,
    },
    method: "GET",
  })
    .then((res) => res.json())
    .catch(() => {
      return NextResponse.json(
        {
          ok: false,
          message: "Invalid token",
        },
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    });
  if (!user || !user.id) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid token",
      },
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  return {
    ...user,
    token: token.replace("Bearer ", ""),
  };
};
