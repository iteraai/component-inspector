import { execFileSync } from 'node:child_process';

const baseRef = process.env.CHANGESET_BASE_REF ?? 'origin/main';

const readGit = (args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
  }).trim();

const isRenameOrCopyStatus = (status) => status.startsWith('R') || status.startsWith('C');

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

const parseChangedFilePaths = (statusLine) => {
  const [status, ...paths] = statusLine.split('\t');

  if (!status) {
    return [];
  }

  if (isRenameOrCopyStatus(status)) {
    return paths.slice(0, 2);
  }

  return paths.slice(0, 1);
};

const toUniquePaths = (filePaths) => [...new Set(filePaths.filter(Boolean))];

const readJsonAtRef = (ref, filePath) => {
  try {
    return JSON.parse(readGit(['show', `${ref}:${filePath}`]));
  } catch {
    return null;
  }
};

const readJsonFile = (filePath) => {
  try {
    return JSON.parse(readGit(['show', `HEAD:${filePath}`]));
  } catch {
    return null;
  }
};

const getChangedPackageManifests = (changedFiles) => {
  return changedFiles.filter(
    (filePath) =>
      filePath.startsWith('packages/') && filePath.endsWith('/package.json'),
  );
};

const hasVersionedReleaseOutput = (changedFiles) => {
  const changedPackageManifests = getChangedPackageManifests(changedFiles);

  if (changedPackageManifests.length === 0) {
    return false;
  }

  return changedPackageManifests.every((packageManifestPath) => {
    const currentManifest = readJsonFile(packageManifestPath);
    const baseManifest = readJsonAtRef(baseRef, packageManifestPath);

    if (
      currentManifest === null ||
      baseManifest === null ||
      typeof currentManifest.version !== 'string' ||
      typeof baseManifest.version !== 'string' ||
      currentManifest.version === baseManifest.version
    ) {
      return false;
    }

    const packageDirectory = packageManifestPath.replace(/\/package\.json$/, '');
    return changedFiles.includes(`${packageDirectory}/CHANGELOG.md`);
  });
};

try {
  readGit(['rev-parse', '--verify', baseRef]);
} catch {
  console.error(
    `Unable to resolve base ref "${baseRef}". Fetch the base branch or set CHANGESET_BASE_REF to an available ref.`,
  );
  process.exit(1);
}

const changedStatusLines = readGit([
  'diff',
  '--name-status',
  '--find-renames',
  '--diff-filter=ACMRD',
  `${baseRef}...HEAD`,
])
  .split('\n')
  .filter(Boolean);

const changedFiles = toUniquePaths(changedStatusLines.flatMap(parseChangedFilePaths));
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

if (hasVersionedReleaseOutput(changedFiles)) {
  console.log(
    'Package-affecting changes include version and changelog output; skipping changeset file requirement.',
  );
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
