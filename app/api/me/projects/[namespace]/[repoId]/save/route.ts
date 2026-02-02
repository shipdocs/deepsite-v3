import { NextRequest, NextResponse } from "next/server";
import { uploadFiles } from "@huggingface/hub";

import { isAuthenticated } from "@/lib/auth";
import { Page } from "@/types";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ namespace: string; repoId: string }> }
) {
  const param = await params;
  const { namespace, repoId } = param;
  const { pages, commitTitle = "Manual changes saved" } = await req.json();

  const isLocal = process.env.SKIP_AUTH === "true" || 
                  namespace?.toLowerCase() === "local user" || 
                  namespace?.toLowerCase() === "local-user";

  // Handle local projects (skip auth and save to disk)
  if (isLocal) {
    const path = await import("path");
    const fs = await import("fs-extra");
    
    const LOCAL_PROJECTS_DIR = path.join(process.cwd(), "local-projects");
    const projectPath = path.join(LOCAL_PROJECTS_DIR, repoId);
    
    try {
      // Save files to disk
      for (const page of pages) {
        const filePath = path.join(projectPath, page.path);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, page.html);
      }
      
      return NextResponse.json({
        ok: true,
        pages,
        commit: {
          title: commitTitle,
          oid: `local-${Date.now()}`,
          date: new Date()
        }
      });
    } catch (error: any) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to save local project" },
        { status: 500 }
      );
    }
  }

  const user = await isAuthenticated();
  if (user instanceof NextResponse || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!pages || !Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Pages are required" },
      { status: 400 }
    );
  }

  try {
    // Prepare files for upload
    const files: File[] = [];
    pages.forEach((page: Page) => {
      // Determine MIME type based on file extension
      let mimeType = "text/html";
      if (page.path.endsWith(".css")) {
        mimeType = "text/css";
      } else if (page.path.endsWith(".js")) {
        mimeType = "text/javascript";
      } else if (page.path.endsWith(".json")) {
        mimeType = "application/json";
      }
      const file = new File([page.html], page.path, { type: mimeType });
      files.push(file);
    });

    const response = await uploadFiles({
      repo: {
        type: "space",
        name: `${namespace}/${repoId}`,
      },
      files,
      commitTitle,
      accessToken: user.token as string,
    });

    return NextResponse.json({
      ok: true,
      pages,
      commit: {
        ...response.commit,
        title: commitTitle,
      }
    });
  } catch (error: any) {
    console.error("Error saving manual changes:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to save changes",
      },
      { status: 500 }
    );
  }
}
