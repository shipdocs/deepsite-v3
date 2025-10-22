/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useMount } from "react-use";
import { toast } from "sonner";
import { usePathname, useRouter } from "next/navigation";

import { useUser } from "@/hooks/useUser";
import { ProjectType, User } from "@/types";
import { useBroadcastChannel } from "@/lib/useBroadcastChannel";

export default function AppContext({
  children,
}: // me: initialData,
{
  children: React.ReactNode;
  // me?: {
  //   user: User | null;
  //   projects: ProjectType[];
  //   errCode: number | null;
  // };
}) {
  const { loginFromCode, user, logout, loading, errCode } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  // useMount(() => {
  //   if (!initialData?.user && !user) {
  //     if ([401, 403].includes(errCode as number)) {
  //       logout();
  //     } else if (pathname.includes("/spaces")) {
  //       if (errCode) {
  //         toast.error("An error occured while trying to log in");
  //       }
  //       // If we did not manage to log in (probs because api is down), we simply redirect to the home page
  //       router.push("/");
  //     }
  //   }
  // });

  const events: any = {};

  useBroadcastChannel("auth", (message) => {
    if (pathname.includes("/auth/callback")) return;

    if (!message.code) return;
    if (message.type === "user-oauth" && message?.code && !events.code) {
      loginFromCode(message.code);
    }
  });

  return children;
}
