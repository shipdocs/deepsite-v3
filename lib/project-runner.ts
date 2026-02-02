import { execa, ExecaChildProcess } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import getPort from 'get-port';

// Store running processes in memory
// Map<repoId, { process: ChildProcess, port: number, url: string, lastUsed: number }>
const activeProjects = new Map<string, ProjectInstance>();

interface ProjectInstance {
  process: ExecaChildProcess;
  port: number;
  url: string;
  lastUsed: number;
  status: 'starting' | 'running' | 'error';
}

const LOCAL_PROJECTS_DIR = path.join(process.cwd(), 'local-projects');
const INACTIVITY_TIMEOUT = 1000 * 60 * 30; // 30 minutes

export class ProjectRunner {
  
  /**
   * Get the running instance for a project, or start one if needed.
   */
  static async getInstance(repoId: string): Promise<ProjectInstance> {
    const existing = activeProjects.get(repoId);
    
    if (existing) {
      existing.lastUsed = Date.now();
      return existing;
    }

    return this.startProject(repoId);
  }

  /**
   * Start a dev server for the project.
   */
  private static async startProject(repoId: string): Promise<ProjectInstance> {
    const projectPath = path.join(LOCAL_PROJECTS_DIR, repoId);
    
    if (!(await fs.pathExists(path.join(projectPath, 'package.json')))) {
      throw new Error('No package.json found. Cannot start project.');
    }

    // Ensure dependencies are installed
    if (!(await fs.pathExists(path.join(projectPath, 'node_modules')))) {
        console.log(`[${repoId}] Installing dependencies...`);
        await execa('npm', ['install'], { cwd: projectPath });
        console.log(`[${repoId}] Dependencies installed.`);
    }

    // Find a free port
    const port = await getPort({ port: [4000, 4001, 4002, 4003, 4004, 4005] });
    const url = `http://localhost:${port}`;

    console.log(`[${repoId}] Starting dev server on port ${port}...`);

    // Determine the start command (usually 'dev' or 'start')
    const pkg = await fs.readJson(path.join(projectPath, 'package.json'));
    const validScripts = ['dev', 'start', 'serve'];
    const script = validScripts.find(s => pkg.scripts?.[s]) || 'dev';

    // Spawn the process
    // We use 'npx vite' directly if vite is detected to force specific port, 
    // but relying on package.json scripts is more generic.
    // For simplicity/robustness with Vite, we force the port via environment variable or flag if possible.
    // Most modern frameworks respect PORT env var.
    const subprocess = execa('npm', ['run', script, '--', '--port', port.toString(), '--host', '0.0.0.0'], {
      cwd: projectPath,
      env: { ...process.env, PORT: port.toString() },
      detached: true, // Allow it to run independently if needed, though we keep a ref
      stdio: 'pipe'
    });

    const instance: ProjectInstance = {
      process: subprocess,
      port,
      url,
      lastUsed: Date.now(),
      status: 'starting'
    };

    activeProjects.set(repoId, instance);

    subprocess.stdout?.on('data', (data) => {
      // console.log(`[${repoId} stdout]: ${data}`);
      if (data.toString().includes('Local:')) {
         instance.status = 'running';
      }
    });

    subprocess.stderr?.on('data', (data) => {
      console.error(`[${repoId} stderr]: ${data}`);
    });

    subprocess.on('close', (code) => {
      console.log(`[${repoId}] Process exited with code ${code}`);
      activeProjects.delete(repoId);
    });

    return instance;
  }

  /**
   * Stop a specific project.
   */
  static async stopProject(repoId: string) {
    const instance = activeProjects.get(repoId);
    if (instance) {
      console.log(`[${repoId}] Stopping server...`);
      instance.process.kill();
      activeProjects.delete(repoId);
    }
  }

  /**
   * Stop all running projects.
   */
  static async stopAll() {
    for (const [repoId] of activeProjects) {
        await this.stopProject(repoId);
    }
  }
}

// Optional: Clean up idle projects periodically
setInterval(() => {
    const now = Date.now();
    for (const [repoId, instance] of activeProjects) {
        if (now - instance.lastUsed > INACTIVITY_TIMEOUT) {
            console.log(`[${repoId}] Stopping due to inactivity.`);
            ProjectRunner.stopProject(repoId);
        }
    }
}, 1000 * 60 * 5); // Check every 5 minutes
