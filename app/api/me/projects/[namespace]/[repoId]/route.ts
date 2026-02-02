import { NextRequest, NextResponse } from "next/server";
import { RepoDesignation, spaceInfo, listFiles, deleteRepo, listCommits, downloadFile } from "@huggingface/hub";
import fs from "fs-extra";
import path from "path";

import { isAuthenticated } from "@/lib/auth";
import { Commit, Page } from "@/types";

const LOCAL_PROJECTS_DIR = path.join(process.cwd(), "local-projects");

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ namespace: string; repoId: string }> }
) {
  const param = await params;
  const { namespace, repoId } = param;

  const isLocal = process.env.SKIP_AUTH === "true" || 
                  namespace?.toLowerCase() === "local user" || 
                  namespace?.toLowerCase() === "local-user";

  if (isLocal) {
      const projectPath = path.join(LOCAL_PROJECTS_DIR, repoId);
      if (await fs.pathExists(projectPath)) {
        await fs.remove(projectPath);
        return NextResponse.json({ ok: true }, { status: 200 });
      } else {
        return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
      }
  }

  const user = await isAuthenticated();

  if (user instanceof NextResponse || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
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
    
    const repo: RepoDesignation = {
      type: "space",
      name: `${namespace}/${repoId}`,
    };
    
    await deleteRepo({
      repo,
      accessToken: user.token as string,
    });

    
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ namespace: string; repoId: string }> }
) {
  const param = await params;
  const { namespace, repoId } = param;

  const isLocal = process.env.SKIP_AUTH === "true" || 
                  namespace?.toLowerCase() === "local user" || 
                  namespace?.toLowerCase() === "local-user";

   if (isLocal) {
      const projectPath = path.join(LOCAL_PROJECTS_DIR, repoId);
      
      if (!(await fs.pathExists(projectPath))) {
          return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
      }

      const htmlFiles: Page[] = [];
      const files: string[] = [];

      async function readFilesRecursively(dir: string, baseDir: string) {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/"); // normalize path

              // Skip noise directories
              if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next" || entry.name === "dist") {
                  continue;
              }

              if (entry.isDirectory()) {
                 await readFilesRecursively(fullPath, baseDir);
              } else {
                if (entry.name.endsWith(".html") || entry.name.endsWith(".css") || entry.name.endsWith(".js") || entry.name.endsWith(".jsx") || entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") || entry.name.endsWith(".json")) {
                   const content = await fs.readFile(fullPath, "utf-8");
                   htmlFiles.push({ path: relativePath, html: content });
                } else {
                   files.push(relativePath); 
                }
              }
          }
      }

      await readFilesRecursively(projectPath, projectPath);

      // Local commits simulation (basic)
      const commits: Commit[] = [{
          title: "Initial Commit (Local)",
          oid: "local-oid",
          date: new Date(),
      }];

      return NextResponse.json(
          {
            project: {
              id: repoId,
              space_id: `${namespace}/${repoId}`,
              private: true,
              _updatedAt: new Date(),
            },
            pages: htmlFiles,
            files: [], // Files listing is limited in local mode for now
            commits,
            ok: true,
          },
          { status: 200 }
      );
  }


  try {
    const space = await spaceInfo({
      name: namespace + "/" + repoId,
      accessToken: user.token as string,
      additionalFields: ["author"],
    });

    if (!space || space.sdk !== "static") {
      return NextResponse.json(
        {
          ok: false,
          error: "Space is not a static space",
        },
        { status: 404 }
      );
    }
    if (space.author !== user.name) {
      return NextResponse.json(
        {
          ok: false,
          error: "Space does not belong to the authenticated user",
        },
        { status: 403 }
      );
    }

    const repo: RepoDesignation = {
      type: "space",
      name: `${namespace}/${repoId}`,
    };

    const htmlFiles: Page[] = [];
    const files: string[] = [];

    const allowedFilesExtensions = ["jpg", "jpeg", "png", "gif", "svg", "webp", "avif", "heic", "heif", "ico", "bmp", "tiff", "tif", "mp4", "webm", "ogg", "avi", "mov", "mp3", "wav", "ogg", "aac", "m4a"];
    
    for await (const fileInfo of listFiles({repo, accessToken: user.token as string})) {
      if (fileInfo.path.endsWith(".html") || fileInfo.path.endsWith(".css") || fileInfo.path.endsWith(".js") || fileInfo.path.endsWith(".json")) {
        const blob = await downloadFile({ repo, accessToken: user.token as string, path: fileInfo.path, raw: true }).catch((error) => {
          return null;
        });
        if (!blob) {
          continue;
        }
        const html = await blob?.text();
        if (!html) {
          continue;
        }
        if (fileInfo.path === "index.html") {
          htmlFiles.unshift({
            path: fileInfo.path,
            html,
          });
        } else {
          htmlFiles.push({
            path: fileInfo.path,
            html,
          });
        }
      }
      if (fileInfo.type === "directory") {
        for await (const subFileInfo of listFiles({repo, accessToken: user.token as string, path: fileInfo.path})) {
          if (allowedFilesExtensions.includes(subFileInfo.path.split(".").pop() || "")) {
            files.push(`https://huggingface.co/spaces/${namespace}/${repoId}/resolve/main/${subFileInfo.path}`);
          } else {
            const blob = await downloadFile({ repo, accessToken: user.token as string, path: subFileInfo.path, raw: true }).catch((error) => {
              return null;
            });
            if (!blob) {
              continue;
            }
            const html = await blob?.text();
            if (!html) {
              continue;
            }
            htmlFiles.push({
              path: subFileInfo.path,
              html,
            });
          }
        }
      }
    }
    const commits: Commit[] = [];
    for await (const commit of listCommits({ repo, accessToken: user.token as string })) {
      if (commit.title.includes("initial commit") || commit.title.includes("image(s)") || commit.title.includes("Removed files from promoting")) {
        continue;
      }
      commits.push({
        title: commit.title,
        oid: commit.oid,
        date: commit.date,
      });
    }
    
    if (htmlFiles.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No HTML files found",
        },
        { status: 404 }
      );
    }
    return NextResponse.json(
      {
        project: {
          id: space.id,
          space_id: space.name,
          private: space.private,
          _updatedAt: space.updatedAt,
        },
        pages: htmlFiles,
        files,
        commits,
        ok: true,
      },
      { status: 200 }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.statusCode === 404) {
      return NextResponse.json(
        { error: "Space not found", ok: false },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: error.message, ok: false },
      { status: 500 }
    );
  }
}
