import * as core from '@actions/core';
import * as buildnoteCli from './libs/buildnote-cli';
import {getInput} from "actions-parsers";

const main = async () => {
  runAction();
};

const runAction = async (): Promise<void> => {
  core.debug('Installing Buildnote CLI');
  await buildnoteCli.installCli(getInput('version'));

  core.startGroup(`buildnote`);
  const output = await buildnoteCli.run();

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
