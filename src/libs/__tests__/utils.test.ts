import {moduleIdFrom, parseSemicolorToArray} from '../utils';

describe('utils.ts', () => {
  it('should parse semicolon to array', () => {
    const inputArray = parseSemicolorToArray(['hello,world']);

    expect(inputArray[0]).toBe('hello');
    expect(inputArray[1]).toBe('world');
  })

  it('should sanitise string as module id', () => {
    expect(moduleIdFrom('')).toBe('-');
    expect(moduleIdFrom('  ')).toBe('-');
    expect(moduleIdFrom('.github/workflows/hello-world.YML')).toBe('hello-world');
    expect(moduleIdFrom('.github/workflows/hello-world.YAML')).toBe('hello-world');
    expect(moduleIdFrom('hello-world.yaml')).toBe('hello-world.yaml');
    expect(moduleIdFrom('hello-world')).toBe('hello-world');
    expect(moduleIdFrom('hello.yaml_world')).toBe('hello.yaml_world');
    expect(moduleIdFrom('hello.world')).toBe('hello.world');
    expect(moduleIdFrom('hello:world')).toBe('hello:world');
    expect(moduleIdFrom('hello,world')).toBe('hello,world');
    expect(moduleIdFrom(' hello world ')).toBe('hello world');
    expect(moduleIdFrom('HellO WorlD ')).toBe('HellO WorlD');
    expect(moduleIdFrom('HellO / WorlD')).toBe('HellO / WorlD');
  })
});
