import * as os from 'os';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import { installCli } from '../buildnote-cli';
import * as exec from '../exec';

jest.mock('os');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  chmodSync: jest.fn(),
}));
jest.mock('@actions/core');
jest.mock('@actions/io');
jest.mock('@actions/tool-cache');
jest.mock('../exec');

const mockedOs = jest.mocked(os);
const mockedIo = jest.mocked(io);
const mockedTc = jest.mocked(tc);
const mockedExec = jest.mocked(exec);

const reports = (version: string) =>
  mockedExec.exec.mockResolvedValue({
    success: true,
    exitCode: 0,
    stdout: version,
    stderr: '',
  });

describe('installCli', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedOs.platform.mockReturnValue('linux');
    mockedOs.arch.mockReturnValue('x64');
    mockedOs.homedir.mockReturnValue('/home/runner');
    mockedIo.which.mockResolvedValue('/home/runner/.buildnote/bin/buildnote');
    mockedIo.rmRF.mockResolvedValue(undefined);
    mockedIo.mkdirP.mockResolvedValue(undefined);
    mockedIo.cp.mockResolvedValue(undefined);
    mockedTc.downloadTool.mockResolvedValue('/tmp/downloaded');
    mockedTc.cacheDir.mockResolvedValue('/opt/hostedtoolcache/buildnote');
  });

  it('should download dev again even when a dev build is already installed', async () => {
    reports('dev');

    await installCli('dev');

    expect(mockedTc.downloadTool).toHaveBeenCalledWith(
      'https://github.com/buildnote/releases/releases/download/buildnote-cli-dev/buildnote-dev-linux-x64',
    );
  });

  it('should skip the download when the pinned version is already installed', async () => {
    reports('1.6.0');

    await installCli('1.6.0');

    expect(mockedTc.downloadTool).not.toHaveBeenCalled();
  });
});
