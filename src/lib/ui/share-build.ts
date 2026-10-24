/** Share-link encoding usable at build time (Node) for example links. */
export function encodeStateForBuild(state: unknown): string {
  return `s=${Buffer.from(JSON.stringify(state), 'utf8').toString('base64url')}`;
}
