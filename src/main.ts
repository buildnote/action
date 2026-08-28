import * as core from '@actions/core';
import * as buildnoteCli from './libs/buildnote-cli';
import * as monitor from './libs/monitor';
import {splitArguments} from './libs/utils';
import {getBooleanInput, getInput, getMultilineInput} from "actions-parsers";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const supportedCommands = ["collect", "guardrails", "monitor", "report", "submit", "version"]

// Commands that gate the build. Their exit code has to reach the step, or
// `--fail-on` is inert through the action.
const gatingCommands = ["guardrails"]

const STATE_IS_POST = "isPost";
const STATE_MONITOR_PID = "monitorPid";
const STATE_MONITOR_LOG = "monitorLog";

const ARGS_FILE = '.buildnote-cli-args';

const runAction = async (): Promise<void> => {
  await buildnoteCli.installCli(getInput('version'))

  if (getBooleanInput("installOnly")) {
    core.info("Installed only")
    return;
  }

  const command: string = getInput('command')
  const verbose: boolean = getBooleanInput('verbose', {required: false}) || false
  const args = getMultilineInput('args')

  if (supportedCommands.indexOf(command) < 0) {
    core.error(`Invalid command '${command}'. Supported commands are [${supportedCommands.join(", ")}]`)
    return
  }

  if (command === "monitor") {
    // The monitor takes real argv rather than an arguments file, so the lines
    // are tokenised here instead of being joined back together with spaces.
    const argv = args.reduce((all, line) => all.concat(splitArguments(line)), [] as string[]);
    return wrapsACommand(argv) ? runMonitorAround(argv, verbose) : attachMonitor(argv, verbose)
  }

  return runCommand(command, args, verbose)
};

// `buildnote monitor -- <command>` traces a command of the user's own; without
// a `--` the monitor attaches to the runner instead and traces the rest of the
// job.
const wrapsACommand = (args: string[]): boolean => args.indexOf('--') >= 0;

const runCommand = async (command: string, args: string[], verbose: boolean): Promise<void> => {
  const fullCommand = (verbose ? ["--verbose"] : []).concat([command, ...args]);
  const fullCommandFileContent = fullCommand.join(" ").trim();

  try {
    core.info(`Running buildnote ${fullCommandFileContent}`);

    fs.writeFileSync(ARGS_FILE, fullCommandFileContent);
    const buildnoteOutput = await buildnoteCli.run(`@${ARGS_FILE}`);

    core.info(buildnoteOutput.stdout)
    if (buildnoteOutput.stderr) core.error(buildnoteOutput.stderr)

    if (!buildnoteOutput.success && gatingCommands.indexOf(command) >= 0) {
      core.setFailed(`buildnote ${command} exited with status ${buildnoteOutput.exitCode}`)
    }
  } catch (err) {
    core.error(err);
  } finally {
    if (fs.existsSync(ARGS_FILE)) fs.unlinkSync(ARGS_FILE)
  }
};

// The wrapped command is a descendant of the monitor, which is the mode that
// needs no privileges at all: Yama already allows tracing your own children.
const runMonitorAround = async (args: string[], verbose: boolean): Promise<void> => {
  const argv = (verbose ? ["--verbose"] : []).concat(["monitor", ...args]);
  core.info(`Running buildnote ${argv.join(" ")}`);

  const buildnoteOutput = await buildnoteCli.runStreaming(...argv);
  if (!buildnoteOutput.success) {
    core.setFailed(`buildnote monitor exited with status ${buildnoteOutput.exitCode}`)
  }
};

// Attaching runs the monitor detached so it outlives this step and records the
// steps that follow; the post step stops it and it submits on the way out.
const attachMonitor = async (args: string[], verbose: boolean): Promise<void> => {
  const target = process.ppid;
  const logFile = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'buildnote', 'monitor.log');

  const argv = (verbose ? ["--verbose"] : []).concat(["monitor", ...args]);
  if (!args.some((arg) => arg.startsWith('--pid'))) argv.push('--pid', String(target));

  core.info(`Attaching buildnote monitor to process ${target} and everything it starts`);
  core.debug(`Process ${target} is ${monitor.cmdlineOf(target)}`);

  monitor.relaxPtraceScope();

  core.saveState(STATE_MONITOR_LOG, logFile);
  const pid = monitor.spawnMonitor(argv, logFile);
  if (!pid) {
    core.error('buildnote monitor could not be started; this job is not being traced.');
    return;
  }
  core.saveState(STATE_MONITOR_PID, String(pid));

  if (!(await monitor.waitUntilAttached(pid))) {
    core.saveState(STATE_MONITOR_PID, '');
    const tail = monitor.logTail(logFile);
    // Monitoring is not a gate, so a runner that will not allow the attach
    // gets a loud annotation rather than a failed job.
    core.error(`buildnote monitor exited before it attached to process ${target}; this job is not being traced.${tail ? `\n${tail}` : ''}`);
    return;
  }

  core.info(`buildnote monitor is running as pid ${pid}`);
};

const runPost = async (): Promise<void> => {
  const pid = parseInt(core.getState(STATE_MONITOR_PID), 10);
  if (!pid) return;

  const logFile = core.getState(STATE_MONITOR_LOG);

  if (!monitor.isAlive(pid)) {
    core.warning(`buildnote monitor (pid ${pid}) is no longer running; part of this job was not traced.`);
  } else {
    core.info(`Stopping buildnote monitor (pid ${pid}) and submitting the recorded commands`);
    if (!(await monitor.stopMonitor(pid))) {
      core.warning(`buildnote monitor (pid ${pid}) did not exit after SIGTERM and had to be killed, so nothing was submitted.`);
    }
  }

  const tail = monitor.logTail(logFile);
  if (tail) core.info(tail);
};

const main = async () => {
  const isPost = !!core.getState(STATE_IS_POST);
  if (isPost) return runPost();

  // Saved before any work, so a main step that fails early does not have the
  // post step re-run it.
  core.saveState(STATE_IS_POST, 'true');
  return runAction();
};

(async () => {
  try {
    await main();
  } catch (err) {
    if (err.message.stderr) {
      core.setFailed(err.message.stderr);
    } else {
      core.setFailed(err.message);
    }
  }
})();
