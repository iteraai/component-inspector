import { execFileSync } from 'node:child_process';

const baseRef = process.env.CHANGESET_BASE_REF ?? 'origin/main';

const readGit = (args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
  }).trim();

const hasIgnoredSuffix = (filePath) =>
  filePath.endsWith('.spec.ts') ||
  filePath.endsWith('.spec.tsx') ||
  filePath.endsWith('.test.ts') ||
  filePath.endsWith('.test.tsx') ||
  filePath.endsWith('.snap');

const isPackageAffectingFile = (filePath) => {
  if (!filePath.startsWith('packages/')) {
    return false;
  }

  if (filePath.endsWith('/README.md') || filePath.includes('/testing/')) {
    return false;
  }

  if (filePath.endsWith('/tests.global.setup.ts') || hasIgnoredSuffix(filePath)) {
    return false;
  }

  return true;
};

try {
  readGit(['rev-parse', '--verify', baseRef]);
} catch {
  console.error(
    `Unable to resolve base ref "${baseRef}". Fetch the base branch or set CHANGESET_BASE_REF to an available ref.`,
  );
  process.exit(1);
}

const changedFiles = readGit([
  'diff',
  '--name-only',
  '--diff-filter=ACMR',
  `${baseRef}...HEAD`,
])
  .split('\n')
  .filter(Boolean);

const packageAffectingFiles = changedFiles.filter(isPackageAffectingFile);

if (packageAffectingFiles.length === 0) {
  console.log('No package-affecting changes detected; skipping changeset requirement.');
  process.exit(0);
}

const changesetFiles = changedFiles.filter(
  (filePath) =>
    filePath.startsWith('.changeset/') &&
    filePath.endsWith('.md') &&
    !filePath.endsWith('README.md'),
);

if (changesetFiles.length > 0) {
  console.log(`Found ${changesetFiles.length} changeset file(s) for package-affecting changes.`);
  process.exit(0);
}

console.error('Package-affecting changes require a changeset file.');
console.error('Run `npm run changeset:add` and commit the generated file under `.changeset/`.');
console.error('');
console.error('Detected package-affecting files:');

for (const filePath of packageAffectingFiles) {
  console.error(`- ${filePath}`);
}

process.exit(1);
