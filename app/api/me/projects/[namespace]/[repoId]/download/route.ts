import { NextRequest, NextResponse } from "next/server";
import { RepoDesignation, listFiles, spaceInfo, downloadFile } from "@huggingface/hub";
import JSZip from "jszip";

import { isAuthenticated } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ namespace: string; repoId: string }> }
) {
  const user = await isAuthenticated();

  if (user instanceof NextResponse || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const param = await params;
  const { namespace, repoId } = param;

  try {
    const space = await spaceInfo({
      name: `${namespace}/${repoId}`,
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

    const zip = new JSZip();

    for await (const fileInfo of listFiles({ 
      repo, 
      accessToken: user.token as string, 
      recursive: true,
    })) {
      if (fileInfo.type === "directory" || fileInfo.path.startsWith(".")) {
        continue;
      }

      try {
        const blob = await downloadFile({ 
          repo, 
          accessToken: user.token as string, 
          path: fileInfo.path, 
          raw: true 
        });

        if (blob) {
          const arrayBuffer = await blob.arrayBuffer();
          zip.file(fileInfo.path, arrayBuffer);
        }
      } catch (error) {
        console.error(`Error downloading file ${fileInfo.path}:`, error);
      }
    }

    const zipBlob = await zip.generateAsync({ 
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6
      }
    });

    const projectName = `${namespace}-${repoId}`.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${projectName}.zip`;

    return new NextResponse(zipBlob, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": zipBlob.size.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to create ZIP file" },
      { status: 500 }
    );
  }
}

