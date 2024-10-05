import * as core from '@actions/core';
import * as buildnoteCli from './libs/buildnote-cli';
import {getBooleanInput, getInput, getMultilineInput} from "actions-parsers";
import * as fs from "fs";

const main = async () => {
  runAction();
};

const runAction = async (): Promise<void> => {
  core.startGroup(`Setup buildnote`)

  core.debug('Installing Buildnote CLI')
  await buildnoteCli.installCli(getInput('version'))
  const installOnly = getBooleanInput("installOnly")

  if (installOnly) {
    core.info("Installed only")
  }

  core.endGroup();

  if (installOnly) return;

  core.startGroup(`Run buildnote`);
  const orgRepo = process.env.GITHUB_REPOSITORY.replace("/", ":")
  const module = getInput('module')
  const build = process.env.GITHUB_RUN_ID + "_" + process.env.GITHUB_RUN_NUMBER
  const descriptor = `${orgRepo}:${module}:${build}`
  const collectOnly = getBooleanInput("collectOnly")
  const command = getMultilineInput('command')
  const output = getInput('output', {required: false}) || process.env.GITHUB_STEP_SUMMARY || ''

  const fileName = '.buildnote-cli-params';
  try {
    let commandParams = [
      "collect", "--descriptor", descriptor,
      "--collectOnly", collectOnly.toString(),
      "--output", output
    ].concat(command);

    fs.writeFileSync(fileName, commandParams.join(" ").trim());

    const buildnoteOutput = await buildnoteCli.run(`@${fileName}`);

    core.info(buildnoteOutput.stdout)
    core.error(buildnoteOutput.stderr)
  } catch (err) {
    core.error(err);
  } finally {
    fs.unlinkSync(fileName)
  }

  core.endGroup();
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
