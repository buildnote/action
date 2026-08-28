import {quote, splitArguments} from '../utils';

describe('utils.ts', () => {
  it('should quote string', () => {
    expect(quote('foo"bar"')).toBe('"foo\\"bar\\""');
  })

  describe('splitArguments', () => {
    it('should split a line on whitespace', () => {
      expect(splitArguments('-- ./gradlew build')).toEqual(['--', './gradlew', 'build']);
    })

    it('should leave a single token alone', () => {
      expect(splitArguments('--')).toEqual(['--']);
    })

    it('should ignore surrounding and repeated whitespace', () => {
      expect(splitArguments('  --pid   1234  ')).toEqual(['--pid', '1234']);
    })

    it('should be empty for a blank line', () => {
      expect(splitArguments('   ')).toEqual([]);
    })

    it('should keep a double quoted section whole', () => {
      expect(splitArguments('-- sh -c "echo hello world"'))
        .toEqual(['--', 'sh', '-c', 'echo hello world']);
    })

    it('should keep a single quoted section whole', () => {
      expect(splitArguments("--name='performance critical command'"))
        .toEqual(['--name=performance critical command']);
    })

    it('should keep an empty quoted argument', () => {
      expect(splitArguments('-- echo ""')).toEqual(['--', 'echo', '']);
    })

    it('should unescape a quote inside a double quoted section', () => {
      expect(splitArguments('-- echo "say \\"hi\\""')).toEqual(['--', 'echo', 'say "hi"']);
    })

    it('should unescape an escaped space', () => {
      expect(splitArguments('-- cat my\\ file.txt')).toEqual(['--', 'cat', 'my file.txt']);
    })
  })
});
