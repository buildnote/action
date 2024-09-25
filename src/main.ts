import * as core from '@actions/core';
import * as buildnoteCli from './libs/buildnote-cli';

const main = async () => {
  runAction();
};

const runAction = async (): Promise<void> => {
  await buildnoteCli.installCli();

  core.startGroup(`buildnote`);
  const output = await buildnoteCli.run();

  // core.setOutput('output', output);
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
