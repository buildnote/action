import * as core from '@actions/core';
import * as buildnoteCli from './libs/buildnote-cli';
import {getBooleanInput, getInput, getMultilineInput} from "actions-parsers";
import * as fs from "fs";
import {moduleIdFrom, quote} from "./libs/utils";

const main = async () => {
  runAction();
};

const runAction = async (): Promise<void> => {
  const supportedCommands = ["collect", "report", "submit", "version"]

  await buildnoteCli.installCli(getInput('version'))
  const installOnly = getBooleanInput("installOnly")

  if (installOnly) {
    core.info("Installed only")
  }

  if (installOnly) return;

  const orgRepo = process.env.GITHUB_REPOSITORY.split("/")
  const org = orgRepo[0]
  const project = orgRepo[1]
  const module = moduleIdFrom(process.env.GITHUB_WORKFLOW || '')
  const build = `${process.env.GITHUB_RUN_ID}_${process.env.GITHUB_RUN_ATTEMPT}`
  const sha = process.env.GITHUB_SHA
  const ref = process.env.GITHUB_REF
  const submitter = process.env.GITHUB_TRIGGERING_ACTOR
  const collectOnly = getBooleanInput("collectOnly")
  const command: string = getInput('command')
  const params = getMultilineInput('params')
  const output = getInput('output', {required: false}) || process.env.GITHUB_STEP_SUMMARY || ''

  if (supportedCommands.indexOf(command) < 0) {
    core.error(`Invalid command '${command}'. Supported commands are [${supportedCommands.join(", ")}]`)
    return
  }

  const fileName = '.buildnote-cli-params';
  try {
    let options: string[]

    switch (command) {
      case "submit":
        options = [
          "--org=" + quote(org),
          "--project=" + quote(project),
          "--module=" + quote(module),
          "--build=" + quote(build),
          "--submitter=" + quote(submitter),
          "--sha=" + quote(sha),
          "--ref=" + quote(ref),
          "--collect-only=" + quote(collectOnly.toString()),
          "--output=" + quote(output)
        ]
        break;

      case "collect":
        options = [
          "--org=" + quote(org),
          "--project=" + quote(project),
          "--module=" + quote(module),
          "--build=" + quote(build),
          "--submitter=" + quote(submitter),
          "--sha=" + quote(sha),
          "--ref=" + quote(ref),
        ]
        break;

      case "report":
        options = [
          "--org=" + quote(org),
          "--project=" + quote(project),
          "--module=" + quote(module),
          "--build=" + quote(build),
          "--submitter=" + quote(submitter),
          "--sha=" + quote(sha),
          "--ref=" + quote(ref),
          "--output=" + quote(output)
        ]
        break;

      case "version":
        options = []
        break;

      default:
        return
    }


    const fullCommand = [command, ...options, ...params];

    fs.writeFileSync(fileName, fullCommand.join(" ").trim());

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
