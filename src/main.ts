import * as core from '@actions/core';
import * as buildnoteCli from './libs/buildnote-cli';
import {getBooleanInput, getInput, getMultilineInput} from "actions-parsers";

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
  const module = "-"
  const build = process.env.GITHUB_RUN_ID + "_" + process.env.GITHUB_RUN_NUMBER
  const descriptor = `${orgRepo}:${module}:${build}`
  const upload = getBooleanInput('upload')
  const include = getMultilineInput('include')
  const exclude = getMultilineInput('exclude')
  const display = getInput('display')
  const output = getInput('output', {required: false}) || process.env.GITHUB_STEP_SUMMARY || ''

  const params = [
    "test-summary",
    "--include", ...include,
    "--exclude", ...exclude,
    "--display", ...(display.split(",").map((item) => item.trim())),
    "--upload", upload.toString(),
    "--output", output,
    "--descriptor", descriptor
  ]

  const buildnoteOutput = await buildnoteCli.run(...params);

  core.info(buildnoteOutput.stdout)
  core.error(buildnoteOutput.stderr)

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
