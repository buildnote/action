export function moduleIdFrom(input: string): string {
  const trimmedInput = input.trim()
  if (trimmedInput == "") return "-"

  const githubFilePrefix = ".github/workflows/"
  return !trimmedInput.startsWith(githubFilePrefix) ? trimmedInput : trimmedInput
    .replace(githubFilePrefix, "")
    .trim()
    .replace(/\.yaml$/gi, "")
    .replace(/\.yml$/gi, "")
}

export function quote(value: string): string {
  return JSON.stringify(value)
}
