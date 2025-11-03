import { NextRequest, NextResponse } from "next/server";
import { RepoDesignation, listFiles, spaceInfo, downloadFile } from "@huggingface/hub";

import { isAuthenticated } from "@/lib/auth";
import { Page } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { 
    params: Promise<{ 
      namespace: string; 
      repoId: string; 
      commitId: string; 
    }> 
  }
) {
  const user = await isAuthenticated();

  if (user instanceof NextResponse || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const param = await params;
  const { namespace, repoId, commitId } = param;

  try {
    const repo: RepoDesignation = {
      type: "space",
      name: `${namespace}/${repoId}`,
    };

    const space = await spaceInfo({
      name: `${namespace}/${repoId}`,
      accessToken: user.token as string,
      additionalFields: ["author"],
    });

    if (!space || space.sdk !== "static") {
      return NextResponse.json(
        { ok: false, error: "Space is not a static space." },
        { status: 404 }
      );
    }
    
    if (space.author !== user.name) {
      return NextResponse.json(
        { ok: false, error: "Space does not belong to the authenticated user." },
        { status: 403 }
      );
    }

    const pages: Page[] = [];
    
    for await (const fileInfo of listFiles({
      repo,
      accessToken: user.token as string,
      revision: commitId,
    })) {
      const fileExtension = fileInfo.path.split('.').pop()?.toLowerCase();
      
      if (fileInfo.path.endsWith(".html") || fileInfo.path.endsWith(".css") || fileInfo.path.endsWith(".js") || fileInfo.path.endsWith(".json")) {
        const blob = await downloadFile({ 
          repo, 
          accessToken: user.token as string, 
          path: fileInfo.path, 
          revision: commitId,
          raw: true 
        });
        const content = await blob?.text();
        
        if (content) {
          if (fileInfo.path === "index.html") {
            pages.unshift({
              path: fileInfo.path,
              html: content,
            });
          } else {
            pages.push({
              path: fileInfo.path,
              html: content,
            });
          }
        }
      }
    }
    
    return NextResponse.json({
      ok: true,
      pages,
    });
  } catch (error: any) {
    console.error("Error fetching commit pages:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to fetch commit pages",
      },
      { status: 500 }
    );
  }
}

