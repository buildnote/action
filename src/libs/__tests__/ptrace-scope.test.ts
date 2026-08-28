import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import {
  PTRACE_SCOPE_PATH,
  cmdlineOf,
  readPtraceScope,
  relaxPtraceScope,
} from '../monitor';

// Only the calls the ptrace plumbing makes are mocked: `@actions/core` reads
// `fs.promises` and `os.EOL` as it loads, and an automock takes those away.
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  platform: jest.fn(),
}));
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execFileSync: jest.fn(),
}));

const mockedFs = jest.mocked(fs);
const mockedOs = jest.mocked(os);
const mockedChildProcess = jest.mocked(childProcess);

const scopeIs = (...values: string[]) =>
  values.reduce(
    (mock, value) => mock.mockReturnValueOnce(value),
    mockedFs.readFileSync,
  );

describe('ptrace scope', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedOs.platform.mockReturnValue('linux');
  });

  describe('readPtraceScope', () => {
    it('should read the scope', () => {
      scopeIs('1\n');

      expect(readPtraceScope()).toBe(1);
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(
        PTRACE_SCOPE_PATH,
        'utf8',
      );
    });

    it('should be undefined when yama is not there', () => {
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      expect(readPtraceScope()).toBeUndefined();
    });

    it('should be undefined when the scope is not a number', () => {
      scopeIs('nonsense\n');

      expect(readPtraceScope()).toBeUndefined();
    });
  });

  describe('relaxPtraceScope', () => {
    it('should not touch the scope off Linux', () => {
      mockedOs.platform.mockReturnValue('darwin');

      expect(relaxPtraceScope()).toBe(false);
      expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
      expect(mockedChildProcess.execFileSync).not.toHaveBeenCalled();
    });

    it('should leave a scope that already allows attaching alone', () => {
      scopeIs('0\n');

      expect(relaxPtraceScope()).toBe(true);
      expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should do nothing when yama is not enforcing', () => {
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      expect(relaxPtraceScope()).toBe(true);
      expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should lower a restricted scope by writing it directly', () => {
      scopeIs('1\n', '0\n');

      expect(relaxPtraceScope()).toBe(true);
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        PTRACE_SCOPE_PATH,
        '0',
      );
      expect(mockedChildProcess.execFileSync).not.toHaveBeenCalled();
    });

    it('should fall back to sudo when the direct write is refused', () => {
      scopeIs('1\n', '1\n', '0\n');
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('EACCES');
      });

      expect(relaxPtraceScope()).toBe(true);
      expect(mockedChildProcess.execFileSync).toHaveBeenCalledWith(
        'sudo',
        ['-n', 'sh', '-c', `echo 0 > ${PTRACE_SCOPE_PATH}`],
        { stdio: 'ignore' },
      );
    });

    it('should give up when the scope stays restricted', () => {
      scopeIs('1\n', '1\n', '1\n', '1\n');

      expect(relaxPtraceScope()).toBe(false);
    });
  });

  describe('cmdlineOf', () => {
    it('should join the nul-separated arguments', () => {
      scopeIs(['sleep', '30', ''].join('\u0000'));

      expect(cmdlineOf(1234)).toBe('sleep 30');
    });
  });
});
