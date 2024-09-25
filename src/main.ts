import * as core from '@actions/core';
import * as buildnoteCli from './libs/buildnote-cli';
import {getBooleanInput, getInput, getMultilineInput} from "actions-parsers";

const main = async () => {
  runAction();
};

const runAction = async (): Promise<void> => {
  core.debug('Installing Buildnote CLI');
  await buildnoteCli.installCli(getInput('version'));

  const upload = getBooleanInput('upload');
  const include = getMultilineInput('include');
  const exclude = getMultilineInput('exclude');
  const display = getInput('display');
  const output = getInput('output');

  const params = [
    "github", "test-summary",
    "--include", ...include,
    "--exclude", ...exclude,
    "--display", ...(display.split(",").map((item) => item.trim())),
    "--upload", upload.toString(),
    "--output", output
  ]

  core.startGroup(`buildnote `+params.join(' '));
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
