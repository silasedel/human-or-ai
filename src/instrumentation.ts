/**
 * Runs once when a server instance starts. Used to surface configuration
 * problems loudly instead of letting a deployment run with a credential that
 * is public in .env.example.
 *
 * Note this logs rather than throwing: the only thing a bad SESSION_SECRET or
 * ADMIN_PASSWORD affects is the admin area, and that already fails closed (see
 * src/lib/admin-auth.ts). Taking the whole public site down over an admin-only
 * key would be a worse outcome than refusing admin sign-in.
 */
export async function register() {
  const { configProblems } = await import("@/lib/env");
  const problems = configProblems();
  if (problems.length === 0) return;

  const banner = "=".repeat(72);
  console.error(`\n${banner}`);
  console.error("Human?: configuration problems detected");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("The admin area is disabled until these are fixed. See .env.example.");
  console.error(`${banner}\n`);
}
