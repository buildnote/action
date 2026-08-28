export function quote(value: string): string {
  return JSON.stringify(value)
}

/**
 * Split a line of arguments the way a shell would, so a `--` separator and the
 * command after it reach the CLI as separate argv entries whether they were
 * written on one line or on several. Quoted sections stay whole, which an
 * arguments file joined back together with spaces would not manage.
 */
export function splitArguments(line: string): string[] {
  const tokens: string[] = [];
  let token: string = undefined;
  let quote: string = undefined;

  const append = (char: string) => {
    token = (token === undefined ? '' : token) + char;
  };

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (quote) {
      if (char === quote) quote = undefined;
      else if (char === '\\' && quote === '"' && i + 1 < line.length) append(line[++i]);
      else append(char);
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      append('');
    } else if (char === '\\' && i + 1 < line.length) {
      append(line[++i]);
    } else if (/\s/.test(char)) {
      if (token !== undefined) tokens.push(token);
      token = undefined;
    } else {
      append(char);
    }
  }

  if (token !== undefined) tokens.push(token);
  return tokens;
}
