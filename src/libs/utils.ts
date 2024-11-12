export function parseSemicolorToArray(input: string[]): string[];
export function parseSemicolorToArray(input?: string[]): undefined | string[] {
  if (!input) {
    return undefined;
  }

  return input.reduce<string[]>(
    (acc, line) =>
      acc
        .concat(line.split(','))
        .filter((x) => x !== '')
        .map((x) => x.trim()),
    [],
  );
}

export function moduleIdFrom(input: string): string {
  const trimmedInput = input.trim()
  if (trimmedInput == "") return "-"

  const githubFilePrefix = ".github/workflows/"
  const sanitisedForGithub = !trimmedInput.startsWith(githubFilePrefix) ? trimmedInput : trimmedInput
    .replace(githubFilePrefix, "")
    .trim()
    .replace(/\.yaml$/gi, "")
    .replace(/\.yml$/gi, "")

  return sanitisedForGithub
    .replace(/[^A-Za-z0-9-+_.]/gi, "-")
    .toLowerCase()
}

