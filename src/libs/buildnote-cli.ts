import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';
import * as exec from './exec';

export async function run(...args: string[]): Promise<exec.ExecResult> {
  return exec.exec(`buildnote`, args, true);
}

export function getPlatform(): string | undefined {
  const platforms = {
    'linux-x64': 'linux-x64',
    // 'linux-arm64': 'linux-arm64',
    'darwin-x64': 'darwin-x64',
    // 'darwin-arm64': 'darwin-arm64',
    'win32-x64': 'windows-x64',
  };

  const runnerPlatform = os.platform();
  const runnerArch = os.arch();

  return platforms[`${runnerPlatform}-${runnerArch}`];
}

export async function installCli(): Promise<void> {
  const platform = getPlatform();
  core.debug(`Platform: ${platform}`);

  if (!platform) {
    throw new Error(
      'Unsupported operating system - Buildnote CLI is only released for Darwin (x64), Linux (x64) and Windows (x64)',
    );
  }

  const destination = path.join(os.homedir(), '.buildnote');
  core.info(`Install destination is ${destination}`);

  await io
    .rmRF(path.join(destination, 'bin'))
    .catch()
    .then(() => {
      core.info(
        `Successfully deleted pre-existing ${path.join(destination, 'bin')}`,
      );
    });

  await io.mkdirP(destination);
  core.debug(`Successfully created ${destination}`);

  await io.mkdirP(path.join(destination, 'bin'))

  switch (platform) {
    case 'windows-x64': {
      await io.cp("buildnote-windows.exe", path.join(destination, 'bin', "buildnote"))
      break;
    }
    case 'linux-x64': {
      await io.cp("buildnote-linux", path.join(destination, 'bin', "buildnote"))
      break;
    }
    case 'darwin-x64': {
      await io.cp("buildnote-mac", path.join(destination, 'bin', "buildnote"))
      break;
    }
  }

  core.addPath(path.join(destination, 'bin', "buildnote"));
}
