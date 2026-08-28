import { execFileSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';

export const PTRACE_SCOPE_PATH = '/proc/sys/kernel/yama/ptrace_scope';

const READY_POLL_MS = 100;
const READY_TIMEOUT_MS = 5_000;
const STOP_POLL_MS = 200;
const INTERRUPT_TIMEOUT_MS = 10_000;
const STOP_TIMEOUT_MS = 60_000;

// GitHub truncates annotations around 4KB; keep the log excerpt below that.
const LOG_TAIL_CHARS = 3_500;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function readPtraceScope(): number | undefined {
  try {
    const scope = parseInt(fs.readFileSync(PTRACE_SCOPE_PATH, 'utf8').trim(), 10);
    return isNaN(scope) ? undefined : scope;
  } catch {
    return undefined;
  }
}

function writeScopeDirectly(): void {
  fs.writeFileSync(PTRACE_SCOPE_PATH, '0');
}

function writeScopeWithSudo(): void {
  execFileSync('sudo', ['-n', 'sh', '-c', `echo 0 > ${PTRACE_SCOPE_PATH}`], {
    stdio: 'ignore',
  });
}


export function relaxPtraceScope(): boolean {
  if (os.platform() !== 'linux') {
    core.warning(
      `Attaching to the runner process is only unprivileged on Linux. On ${os.platform()} the monitor needs elevated privileges to attach to a process it did not start.`,
    );
    return false;
  }

  const before = readPtraceScope();
  if (before === undefined) {
    core.debug(`${PTRACE_SCOPE_PATH} is absent; Yama is not restricting ptrace`);
    return true;
  }
  if (before === 0) {
    core.debug(`${PTRACE_SCOPE_PATH} is already 0`);
    return true;
  }

  core.info(
    `${PTRACE_SCOPE_PATH} is ${before}; lowering it to 0 so buildnote monitor can attach to the runner process`,
  );

  for (const write of [writeScopeDirectly, writeScopeWithSudo]) {
    try {
      write();
    } catch (err) {
      core.debug(`${write.name} failed: ${err}`);
    }
    if (readPtraceScope() === 0) return true;
  }

  core.warning(
    `Could not lower ${PTRACE_SCOPE_PATH} to 0 (it is still ${readPtraceScope()}). Attaching to the runner process will fail. Run the monitor around a command instead, or give the runner CAP_SYS_PTRACE.`,
  );
  return false;
}

export function cmdlineOf(pid: number): string {
  try {
    return fs
      .readFileSync(`/proc/${pid}/cmdline`, 'utf8')
      .split('\0')
      .filter((part) => part.length > 0)
      .join(' ');
  } catch {
    return '<unavailable>';
  }
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}


export function spawnMonitor(args: string[], logFile: string): number {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const out = fs.openSync(logFile, 'a');
  const env = { ...process.env };
  delete env.RUNNER_TRACKING_ID;

  try {
    const child = spawn('buildnote', args, {
      detached: true,
      stdio: ['ignore', out, out],
      env,
    });
    child.unref();
    return child.pid;
  } finally {
    fs.closeSync(out);
  }
}

export async function waitUntilAttached(
  pid: number,
  timeoutMs: number = READY_TIMEOUT_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return false;
    await wait(READY_POLL_MS);
  }
  return isAlive(pid);
}

function signal(pid: number, sig: NodeJS.Signals): boolean {
  try {
    process.kill(pid, sig);
    return true;
  } catch {
    return false;
  }
}

async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true;
    await wait(STOP_POLL_MS);
  }
  return !isAlive(pid);
}

export async function stopMonitor(
  pid: number,
  timeoutMs: number = STOP_TIMEOUT_MS,
  interruptTimeoutMs: number = INTERRUPT_TIMEOUT_MS,
): Promise<boolean> {
  if (!signal(pid, 'SIGINT')) return true;
  if (await waitForExit(pid, interruptTimeoutMs)) return true;

  if (!signal(pid, 'SIGTERM')) return true;
  if (await waitForExit(pid, timeoutMs)) return true;

  signal(pid, 'SIGKILL');
  return false;
}

export function logTail(logFile: string): string {
  try {
    const text = fs.readFileSync(logFile, 'utf8').trimEnd();
    return text.length > LOG_TAIL_CHARS
      ? `...${text.slice(-LOG_TAIL_CHARS)}`
      : text;
  } catch {
    return '';
  }
}
