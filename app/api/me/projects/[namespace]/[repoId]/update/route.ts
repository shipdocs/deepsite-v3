import { NextRequest, NextResponse } from "next/server";
import { createRepo, RepoDesignation, uploadFiles } from "@huggingface/hub";
import fs from "fs-extra";
import path from "path";

import { isAuthenticated } from "@/lib/auth";
import { Page } from "@/types";
import { COLORS } from "@/lib/utils";
import { injectDeepSiteBadge, isIndexPage } from "@/lib/inject-badge";
import { pagesToFiles } from "@/lib/format-ai-response";

/**
 * UPDATE route - for updating existing projects or creating new ones after AI streaming
 * This route handles the HuggingFace upload after client-side AI response processing
 */
const LOCAL_PROJECTS_DIR = path.join(process.cwd(), "local-projects");

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ namespace: string; repoId: string }> }
) {
  const user = await isAuthenticated();
  if (user instanceof NextResponse || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const param = await params;
  let { namespace, repoId } = param;
  const { pages, commitTitle = "AI-generated changes", isNew, projectName } = await req.json();

  if (!pages || !Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Pages are required" },
      { status: 400 }
    );
  }

  try {
    if (process.env.SKIP_AUTH === "true") {
       let projectPath = path.join(LOCAL_PROJECTS_DIR, repoId);

       if (isNew) {
          const title = projectName || "DeepSite Project";
          const formattedTitle = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .split("-")
            .filter(Boolean)
            .join("-")
            .slice(0, 96);
          
          repoId = formattedTitle;
          projectPath = path.join(LOCAL_PROJECTS_DIR, repoId);
          namespace = user.name;
          
          // Ensure directory exists
          await fs.ensureDir(projectPath);

           // Add README.md for new projects
            const colorFrom = COLORS[Math.floor(Math.random() * COLORS.length)];
            const colorTo = COLORS[Math.floor(Math.random() * COLORS.length)];
            const README = `---
title: ${title}
colorFrom: ${colorFrom}
colorTo: ${colorTo}
emoji: 🐳
sdk: static
pinned: false
tags:
  - deepsite-v3
---

# Welcome to your new DeepSite project!
This project was created with [DeepSite](https://huggingface.co/deepsite).
`;
           await fs.writeFile(path.join(projectPath, "README.md"), README);
       }

       // Write pages to disk
       for (const page of pages) {
           let content = page.html;
           // Inject badge only for index pages on create (same logic as HF)
           if (isNew && page.path.endsWith(".html") && isIndexPage(page.path)) {
               content = injectDeepSiteBadge(page.html);
           }
           
           const filePath = path.join(projectPath, page.path);
           await fs.ensureDir(path.dirname(filePath));
           await fs.writeFile(filePath, content);
       }
       
       return NextResponse.json({
          ok: true,
          pages,
          repoId: `${namespace}/${repoId}`,
          commit: {
            title: commitTitle,
            oid: "local-oid",
            date: new Date(),
          }
        });
    }

    let files: File[];
    
    if (isNew) {
      // Creating a new project
      const title = projectName || "DeepSite Project";
      const formattedTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .split("-")
        .filter(Boolean)
        .join("-")
        .slice(0, 96);

      const repo: RepoDesignation = {
        type: "space",
        name: `${user.name}/${formattedTitle}`,
      };

      try {
        const { repoUrl } = await createRepo({
          repo,
          accessToken: user.token as string,
        });
        namespace = user.name;
        repoId = repoUrl.split("/").slice(-2).join("/").split("/")[1];
      } catch (createRepoError: any) {
        return NextResponse.json(
          {
            ok: false,
            error: `Failed to create repository: ${createRepoError.message || 'Unknown error'}`,
          },
          { status: 500 }
        );
      }

      // Prepare files with badge injection for new projects
      files = [];
      pages.forEach((page: Page) => {
        let mimeType = "text/html";
        if (page.path.endsWith(".css")) {
          mimeType = "text/css";
        } else if (page.path.endsWith(".js")) {
          mimeType = "text/javascript";
        } else if (page.path.endsWith(".json")) {
          mimeType = "application/json";
        }
        const content = (mimeType === "text/html" && isIndexPage(page.path))
          ? injectDeepSiteBadge(page.html)
          : page.html;
        const file = new File([content], page.path, { type: mimeType });
        files.push(file);
      });

      // Add README.md for new projects
      const colorFrom = COLORS[Math.floor(Math.random() * COLORS.length)];
      const colorTo = COLORS[Math.floor(Math.random() * COLORS.length)];
      const README = `---
title: ${title}
colorFrom: ${colorFrom}
colorTo: ${colorTo}
emoji: 🐳
sdk: static
pinned: false
tags:
  - deepsite-v3
---

# Welcome to your new DeepSite project!
This project was created with [DeepSite](https://huggingface.co/deepsite).
`;
      files.push(new File([README], "README.md", { type: "text/markdown" }));
    } else {
      // Updating existing project - no badge injection
      files = pagesToFiles(pages);
    }

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
      repoId: `${namespace}/${repoId}`,
      commit: {
        ...response.commit,
        title: commitTitle,
      }
    });
  } catch (error: any) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to update project",
      },
      { status: 500 }
    );
  }
}

