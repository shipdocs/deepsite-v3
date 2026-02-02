import { listSpaces } from "@huggingface/hub";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import fs from "fs-extra";
import path from "path";

export async function GET() {
  const authHeaders = await headers();
  const token = authHeaders.get("Authorization");

  if (process.env.SKIP_AUTH === "true") {
      const LOCAL_PROJECTS_DIR = path.join(process.cwd(), "local-projects");
      await fs.ensureDir(LOCAL_PROJECTS_DIR);
      
      const localProjects = [];
      const entries = await fs.readdir(LOCAL_PROJECTS_DIR, { withFileTypes: true });
      
      for (const entry of entries) {
          if (entry.isDirectory()) {
             const projectPath = path.join(LOCAL_PROJECTS_DIR, entry.name);
             const readmePath = path.join(projectPath, "README.md");
             let title = entry.name;
             
             if (await fs.pathExists(readmePath)) {
                 const readmeContent = await fs.readFile(readmePath, "utf-8");
                 const titleMatch = readmeContent.match(/title: (.*)/);
                 if (titleMatch) title = titleMatch[1];
             }

             localProjects.push({
                 id: entry.name,
                 name: `local-user/${entry.name}`, // Simulate namespace
                 sdk: "static",
                 likes: 0,
                 private: true,
                 lastModified: (await fs.stat(projectPath)).mtime,
                 cardData: {
                     title,
                     emoji: "🐳",
                     colorFrom: "blue", 
                     colorTo: "blue",
                     tags: ["deepsite-v3"]
                 }
             });
          }
      }
      
      // Simulate user for local mode
      const localUser = { name: "local-user", fullname: "Local User", avatarUrl: "" };
      return NextResponse.json({ user: localUser, projects: localProjects, errCode: null }, { status: 200 });
  }

  if (!token) {
    return NextResponse.json({ user: null, errCode: 401 }, { status: 401 });
  }

  const userResponse = await fetch("https://huggingface.co/api/whoami-v2", {
    headers: {
      Authorization: `${token}`,
    },
  });

  if (!userResponse.ok) {
    return NextResponse.json(
      { user: null, errCode: userResponse.status },
      { status: userResponse.status }
    );
  }
  const user = await userResponse.json();
  const projects = [];
  for await (const space of listSpaces({
    accessToken: token.replace("Bearer ", "") as string,
    additionalFields: ["author", "cardData"],
    search: {
      owner: user.name,
    }
  })) {
    if (
      space.sdk === "static" &&
      Array.isArray((space.cardData as { tags?: string[] })?.tags) &&
      (
        ((space.cardData as { tags?: string[] })?.tags?.includes("deepsite-v3")) ||
        ((space.cardData as { tags?: string[] })?.tags?.includes("deepsite"))
      )
    ) {
      projects.push(space);
    }
  }

  return NextResponse.json({ user, projects, errCode: null }, { status: 200 });
}
