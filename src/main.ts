import * as core from '@actions/core';
import * as buildnoteCli from './libs/buildnote-cli';
import {getBooleanInput, getInput, getMultilineInput} from "actions-parsers";
import * as fs from "fs";

const main = async () => {
  runAction();
};

const runAction = async (): Promise<void> => {
  const supportedCommands = ["collect", "submit", "report", "version"]

  await buildnoteCli.installCli(getInput('version'))
  const installOnly = getBooleanInput("installOnly")

  if (installOnly) {
    core.info("Installed only")
  }

  if (installOnly) return;
  const command: string = getInput('command')
  const verbose: boolean = getBooleanInput('verbose', {required: false}) || false
  const args = getMultilineInput('args')

  if (supportedCommands.indexOf(command) < 0) {
    core.error(`Invalid command '${command}'. Supported commands are [${supportedCommands.join(", ")}]`)
    return
  }

  const fileName = '.buildnote-cli-args';
  try {
    let options: string[]

    switch (command) {
      case "submit":
        options = []
        break;

      case "collect":
        options = []
        break;

      case "report":
        options = []
        break;

      case "version":
        options = []
        break;

      default:
        return
    }

    const fullCommand = (verbose ? ["--verbose"] : []).concat([command, ...options, ...args]);

    const fullCommandFileContent = fullCommand.join(" ").trim();
    core.info(`Running buildnote ${fullCommandFileContent}`);

    fs.writeFileSync(fileName, fullCommandFileContent);
    const buildnoteOutput = await buildnoteCli.run(`@${fileName}`);

    core.info(buildnoteOutput.stdout)
    core.error(buildnoteOutput.stderr)
  } catch (err) {
    core.error(err);
  } finally {
    fs.unlinkSync(fileName)
  }
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
