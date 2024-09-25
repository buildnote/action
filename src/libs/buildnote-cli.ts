import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';
import * as exec from './exec';
import * as tc from "@actions/tool-cache";

export async function run(...args: string[]): Promise<exec.ExecResult> {
  return exec.exec(`buildnote`, args, true);
}

export async function getVersion(): Promise<string | undefined> {
  const res = await exec.exec('buildnote', ['version']);
  if (res.success)
    return res.stdout;
  else
    return undefined;
}

export function getPlatform(): string | undefined {
  const platforms = {
    'linux-x64': 'linux-x64',
    // 'linux-arm64': 'linux-arm64',
    'darwin-x64': 'darwin-x64',
    'darwin-arm64': 'darwin-arm64',
    'win32-x64': 'windows-x64',
  };

  const runnerPlatform = os.platform();
  const runnerArch = os.arch();

  return platforms[`${runnerPlatform}-${runnerArch}`];
}

export async function installCli(requiredVersion: string): Promise<void> {
  const downloads = {
    'linux-x64': `https://get.buildnote.io/releases/cli/buildnote-${requiredVersion}-linux-x64`,
    'darwin-x64': `https://get.buildnote.io/releases/cli/buildnote-${requiredVersion}-darwin-x64`,
    'darwin-arm64': `https://get.buildnote.io/releases/cli/buildnote-${requiredVersion}-darwin-arm64`,
    'windows-x64': `https://get.buildnote.io/releases/cli/buildnote-${requiredVersion}-windows-x64.exe`,
  };

  const platform = getPlatform();
  core.debug(`Platform: ${platform}`);

  if (!platform) {
    throw new Error(
      'Unsupported operating system - Buildnote CLI is only released for Darwin (x64), Linux (x64) and Windows (x64)',
    );
  }

  const isInstalled = await io.which('buildnote');
  let currentVersion = undefined;

  if (isInstalled) {
    currentVersion = await getVersion()
    if (currentVersion == requiredVersion) {
      core.info(`Buildnote version ${currentVersion} is already installed on this machine. Skipping download`);
    } else {
      core.info(`Buildnote ${currentVersion} does not satisfy the desired version ${requiredVersion}. Proceeding to download`);
    }
  }

  const destination = path.join(os.homedir(), '.buildnote');

  if (currentVersion != requiredVersion) {
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
    core.debug(`Successfully created ${destination}`)

    await io.mkdirP(path.join(destination, 'bin'))
    core.debug(`Successfully created ${path.join(destination, 'bin')}`)

    const downloaded = await tc.downloadTool(downloads[platform]);
    core.debug(`Successfully downloaded ${downloads[platform]} to ${downloaded}`)

    await io.mv(downloaded, path.join(destination, 'bin', "buildnote"))
  }

  const cachedPath = await tc.cacheDir(path.join(destination, 'bin'), 'buildnote', requiredVersion)
  core.addPath(cachedPath)

  const installedVersion = await getVersion()
  core.debug(`Running buildnote version is: ${installedVersion}`)

  if (requiredVersion != installedVersion) {
    throw new Error(`Installed version "${installedVersion}" did not the same as required "${requiredVersion}"`);
  }
}
