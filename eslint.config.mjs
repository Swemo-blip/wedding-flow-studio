import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    // Build output and agent worktrees are not source. Without this, an agent
    // worktree under .claude/ that happens to contain a .next build makes
    // `npm run lint` fail with dozens of errors from generated chunks — the
    // project's own verification command breaks for reasons unrelated to the code.
    ignores: [".next/**", "out/**", ".claude/worktrees/**"]
  },
  ...(Array.isArray(nextVitals) ? nextVitals : [nextVitals])
];

export default config;
