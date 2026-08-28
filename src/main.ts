import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as core from '@actions/core';
import {getBooleanInput, getInput, getMultilineInput} from "actions-parsers";
import * as buildnoteCli from './libs/buildnote-cli';
import * as monitor from './libs/monitor';
import {splitArguments} from './libs/utils';

const supportedCommands = ["collect", "guardrails", "monitor", "report", "submit", "version"]

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
    const argv = args.reduce((all, line) => all.concat(splitArguments(line)), [] as string[]);
    return wrapsACommand(argv) ? runMonitorAround(argv, verbose) : attachMonitor(argv, verbose)
  }

  return runCommand(command, args, verbose)
};

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

const runMonitorAround = async (args: string[], verbose: boolean): Promise<void> => {
  const argv = (verbose ? ["--verbose"] : []).concat(["monitor", ...args]);
  core.info(`Running buildnote ${argv.join(" ")}`);

  const buildnoteOutput = await buildnoteCli.runStreaming(...argv);
  if (!buildnoteOutput.success) {
    core.setFailed(`buildnote monitor exited with status ${buildnoteOutput.exitCode}`)
  }
};


const attachMonitor = async (args: string[], verbose: boolean): Promise<void> => {
  const logFile = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'buildnote', 'monitor.log');

  const argv = (verbose ? ["--verbose"] : []).concat(["monitor", ...args]);

  core.info('Attaching buildnote monitor to the runner process and everything it starts');
  core.debug(`This action runs as ${process.pid}, launched by ${process.ppid} (${monitor.cmdlineOf(process.ppid)})`);

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
    core.error(`Buildnote monitor exited before it attached to the runner process; this job is not being traced.${tail ? `\n${tail}` : ''}`);
    return;
  }

  core.info(`Buildnote monitor is running as pid ${pid}`);
};

const runPost = async (): Promise<void> => {
  const pid = parseInt(core.getState(STATE_MONITOR_PID), 10);
  if (!pid) return;

  const logFile = core.getState(STATE_MONITOR_LOG);

  if (!monitor.isAlive(pid)) {
    core.warning(`Buildnote monitor (pid ${pid}) is no longer running; part of this job was not traced.`);
  } else {
    core.info(`Stopping buildnote monitor (pid ${pid}) and submitting the recorded commands`);
    if (!(await monitor.stopMonitor(pid))) {
      core.warning(`Buildnote monitor (pid ${pid}) did not exit after SIGINT and SIGTERM and had to be killed, so nothing was submitted.`);
    }
  }

  const tail = monitor.logTail(logFile);
  if (tail) core.info(tail);
};

const main = async () => {
  const isPost = !!core.getState(STATE_IS_POST);
  if (isPost) return runPost();
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
