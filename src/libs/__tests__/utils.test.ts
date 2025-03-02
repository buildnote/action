import {quote} from '../utils';

describe('utils.ts', () => {
  it('should quote string', () => {
    expect(quote('foo"bar"')).toBe('\"foo\\\"bar\\\"\"');
  })
});
