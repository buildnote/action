import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';
import * as exec from './exec';
import * as tc from "@actions/tool-cache";
import * as fs from "fs";

export async function run(...args: string[]): Promise<exec.ExecResult> {
  return exec.exec(`buildnote`, args, true);
}

export async function getVersion(): Promise<string | undefined> {
  const res = await exec.exec('buildnote', ['version']);
  if (res.success)
    return res.stdout.trim();
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

export async function getLatestVersion(): Promise<string> {
  const latestVersionUrl = 'https://github.com/buildnote/releases/releases/download/buildnote-cli-latest/latest_version';

  try {
    const response = await fetch(latestVersionUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch latest version: ${response.status}`);
    }
    const version = await response.text();
    return version.trim();
  } catch (error) {
    core.debug(`Failed to get latest version from GitHub: ${error}`);
    throw new Error(`Could not determine latest version of Buildnote from ${latestVersionUrl}. Check your internet connection.`);
  }
}

export async function installCli(requiredVersion: string): Promise<void> {
  // Resolve "latest" to actual version number
  let resolvedVersion = requiredVersion;
  if (requiredVersion === 'latest') {
    resolvedVersion = await getLatestVersion();
    core.info(`Resolved latest version to: ${resolvedVersion}`);
  }

  const downloads = {
    'linux-x64': `https://github.com/buildnote/releases/releases/download/buildnote-cli-${resolvedVersion}/buildnote-${resolvedVersion}-linux-x64`,
    'darwin-x64': `https://github.com/buildnote/releases/releases/download/buildnote-cli-${resolvedVersion}/buildnote-${resolvedVersion}-darwin-x64`,
    'darwin-arm64': `https://github.com/buildnote/releases/releases/download/buildnote-cli-${resolvedVersion}/buildnote-${resolvedVersion}-darwin-arm64`,
    'windows-x64': `https://github.com/buildnote/releases/releases/download/buildnote-cli-${resolvedVersion}/buildnote-${resolvedVersion}-windows-x64.exe`,
  };

  const platform = getPlatform();
  core.debug(`Platform ${platform}`);

  if (!platform) {
    throw new Error(
      'Unsupported operating system - Buildnote CLI is only released for Darwin (x64), Linux (x64) and Windows (x64)',
    );
  }

  const isInstalled = await io.which('buildnote');
  let currentVersion = undefined;

  if (isInstalled) {
    currentVersion = await getVersion()
    if (currentVersion == resolvedVersion) {
      core.info(`Buildnote version ${currentVersion} is already installed on this machine. Skipping download`);
    } else {
      core.info(`Buildnote ${currentVersion} does not satisfy the desired version ${resolvedVersion}. Proceeding to download`);
    }
  }

  const destination = path.join(os.homedir(), '.buildnote');

  if (currentVersion != resolvedVersion) {
    core.info(`Install destination is ${destination}`);

    await io
      .rmRF(path.join(destination, 'bin'))
      .catch()
      .then(() => {
        core.info(`Successfully deleted pre-existing ${path.join(destination, 'bin')}`);
      });

    await io.mkdirP(path.join(destination, 'bin'))
    core.debug(`Successfully created ${path.join(destination, 'bin')}`)

    const downloaded = await tc.downloadTool(downloads[platform]);
    core.debug(`Successfully downloaded ${downloads[platform]} to ${downloaded}`)

    await io.cp(downloaded, path.join(destination, 'bin', "buildnote"))

    fs.chmod(path.join(destination, 'bin', "buildnote"), 0o744, (error) => {
      if (error) {
        throw error
      } else {
        core.debug('Permissions updated successfully');
      }
    })
  }

  const cachedPath = await tc.cacheDir(path.join(destination, 'bin'), 'buildnote', resolvedVersion)
  core.addPath(cachedPath)

  const installedVersion = (await exec.exec(`buildnote`, ['version'], true)).stdout.trim();
  core.debug(`Running buildnote version is: ${installedVersion}`)

  if (resolvedVersion != installedVersion) {
    throw new Error(`Installed version "${installedVersion}" did not match required "${resolvedVersion}"`);
  }
}
