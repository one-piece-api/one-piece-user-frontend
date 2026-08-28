/** Avatar-circle shorthand for a name - the first two characters, uppercased. */
export function initialsOf(name: string): string {
  return name.slice(0, 2).toUpperCase();
}
