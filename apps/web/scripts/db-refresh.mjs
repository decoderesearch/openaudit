// Resets the Neon dev branch to the current state of its parent (production).
// Needs NEON_PROJECT_ID, NEON_DEV_BRANCH and a Neon login (NEON_API_KEY or `neonctl auth`).
import { execFileSync } from 'node:child_process';

const project = process.env.NEON_PROJECT_ID;
const branch = process.env.NEON_DEV_BRANCH;

if (!project || !branch) {
  console.error('Set NEON_PROJECT_ID and NEON_DEV_BRANCH in .env.local.');
  process.exit(1);
}
if (/^(main|prod|production)$/i.test(branch)) {
  console.error(`Refusing to reset "${branch}". It looks like the production branch.`);
  process.exit(1);
}

execFileSync('npx', ['-y', 'neonctl@6', 'branches', 'reset', branch, '--parent', '--project-id', project], {
  stdio: 'inherit',
});
console.log(`\nReset "${branch}". Run "pnpm db:migrate" to apply your new migrations.`);
