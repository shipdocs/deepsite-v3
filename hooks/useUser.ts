/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCookie } from "react-use";
import { useRouter } from "next/navigation";

import { ProjectType, User } from "@/types";
import { api } from "@/lib/api";
import { toast } from "sonner";


export const useUser = (initialData?: {
  user: User | null;
  errCode: number | null;
  projects: ProjectType[];
}) => {
  const client = useQueryClient();
  const router = useRouter();
  const [currentRoute, setCurrentRoute, removeCurrentRoute] = useCookie("deepsite-currentRoute");

  const { data: { user, errCode } = { user: null, errCode: null }, isLoading } =
    useQuery({
      queryKey: ["user.me"],
      queryFn: async () => {
        return { user: initialData?.user || null, errCode: initialData?.errCode || null };
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: false,
      initialData: initialData
        ? { user: initialData?.user, errCode: initialData?.errCode }
        : undefined,
      enabled: false,
    });

  const { data: loadingAuth } = useQuery({
    queryKey: ["loadingAuth"],
    queryFn: async () => false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const setLoadingAuth = (value: boolean) => {
    client.setQueryData(["setLoadingAuth"], value);
  };

  const { data: projects } = useQuery({
    queryKey: ["me.projects"],
    queryFn: async () => [],
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    initialData: initialData?.projects || [],
  });
  const setProjects = (projects: ProjectType[]) => {
    client.setQueryData(["me.projects"], projects);
  };

  const openLoginWindow = async () => {
    setCurrentRoute(window.location.pathname);
    return router.push("/auth");
  };

  const loginFromCode = async (code: string) => {
    setLoadingAuth(true);
    if (loadingAuth) return;
    await api
      .post("/auth", { code })
      .then(async (res: any) => {
        if (res.data) {
          client.setQueryData(["user.me"], {
            user: res.data.user,
            errCode: null,
          });
          // if (currentRoute) {
          //   router.push(currentRoute);
          //   removeCurrentRoute();
          // } else {
            router.push("/");
          // }
          toast.success("Login successful");
        }
      })
      .catch((err: any) => {
        toast.error(err?.data?.message ?? err.message ?? "An error occurred");
      })
      .finally(() => {
        setLoadingAuth(false);
      });
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
      removeCurrentRoute();
      client.clear();
      toast.success("Logout successful");
      window.location.reload();
    } catch (error) {
      console.error("Logout error:", error);
      removeCurrentRoute();
      client.clear()
      toast.success("Logout successful");
      window.location.reload();
    }
  };

  return {
    user,
    projects,
    setProjects,
    errCode,
    loading: isLoading || loadingAuth,
    openLoginWindow,
    loginFromCode,
    logout,
  };
};
