import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import {
  cmdlineOf,
  isAlive,
  logTail,
  stopMonitor,
  waitUntilAttached,
} from '../monitor';

const DEAD_PID = 4194303;

describe('monitor.ts', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildnote-monitor-test-'));
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  describe('logTail', () => {
    it('should be empty when there is no log', () => {
      expect(logTail(path.join(workDir, 'missing.log'))).toBe('');
    });

    it('should return the whole log when it is short', () => {
      const logFile = path.join(workDir, 'monitor.log');
      fs.writeFileSync(logFile, 'cannot attach to 1234\n');

      expect(logTail(logFile)).toBe('cannot attach to 1234');
    });

    it('should keep the end of a long log', () => {
      const logFile = path.join(workDir, 'monitor.log');
      fs.writeFileSync(logFile, `${'x'.repeat(5000)}tail`);

      const tail = logTail(logFile);

      expect(tail.startsWith('...')).toBe(true);
      expect(tail.endsWith('tail')).toBe(true);
      expect(tail.length).toBe(3503);
    });
  });

  describe('isAlive', () => {
    it('should see a running process', () => {
      expect(isAlive(process.pid)).toBe(true);
    });

    it('should not see a process that does not exist', () => {
      expect(isAlive(DEAD_PID)).toBe(false);
    });
  });

  describe('waitUntilAttached', () => {
    it('should report a monitor that is still running as attached', async () => {
      expect(await waitUntilAttached(process.pid, 200)).toBe(true);
    });

    it('should report a monitor that exited as not attached', async () => {
      expect(await waitUntilAttached(DEAD_PID, 5000)).toBe(false);
    });
  });

  describe('stopMonitor', () => {
    it('should terminate a running monitor', async () => {
      const child = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
      child.unref();

      expect(await stopMonitor(child.pid, 10000)).toBe(true);
      expect(isAlive(child.pid)).toBe(false);
    });

    it('should escalate to SIGTERM when the monitor ignores SIGINT', async () => {
      const child = spawn(
        'node',
        ['-e', 'process.on("SIGINT", () => {}); setInterval(() => {}, 1000)'],
        { detached: true, stdio: 'ignore' },
      );
      child.unref();

      expect(await stopMonitor(child.pid, 10000, 200)).toBe(true);
      expect(isAlive(child.pid)).toBe(false);
    });

    it('should be a no-op when the monitor is already gone', async () => {
      expect(await stopMonitor(DEAD_PID, 10000)).toBe(true);
    });
  });

  describe('cmdlineOf', () => {
    it('should be unavailable when there is no procfs entry', () => {
      expect(cmdlineOf(DEAD_PID)).toBe('<unavailable>');
    });
  });
});
