import { NextRequest, NextResponse } from "next/server";
import { ProjectRunner } from "@/lib/project-runner";
import { isAuthenticated } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ namespace: string; repoId: string }> }
) {
  // 1. Authenticate (or skip if local mode)
  const user = await isAuthenticated();
  if (user instanceof NextResponse || !user) {
    if (process.env.SKIP_AUTH !== "true") {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  const { repoId } = await params;

  try {
    // 2. Get or Start the Project Instance
    const instance = await ProjectRunner.getInstance(repoId);

    return NextResponse.json({
        ok: true,
        status: instance.status,
        url: instance.url,
        port: instance.port
    });

  } catch (error: any) {
    console.error(`Failed to start project ${repoId}:`, error);
    return NextResponse.json(
        { ok: false, error: error.message || "Failed to start dev server" }, 
        { status: 500 }
    );
  }
}
