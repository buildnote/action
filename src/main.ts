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
  const outputPath = getInput('output');

  core.startGroup(`buildnote`);
  const output = await buildnoteCli.run(
    "github", "test-summary",
    "--include", ...include,
    "--exclude", ...exclude,
    "--display", ...(display.split(",").map((item) => item.trim())),
    "--upload", upload.toString(),
    "--output", outputPath,
  );

  core.info(output.stdout)
  core.error(output.stderr)

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
