import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = path.join(projectRoot, 'package.json');
const lockPath = path.join(projectRoot, 'package-lock.json');
const frontendVersionPath = path.join(projectRoot, 'public', 'version.json');
const backendVersionPath = path.join(projectRoot, 'backend', 'public', 'version.json');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const incrementPatch = (version) => {
  const match = /^([0-9]+)\.([0-9]+)\.([0-9]+)$/.exec(version);
  if (!match) {
    throw new Error(`Cannot increment unsupported version "${version}". Expected x.y.z.`);
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
};

const packageJson = readJson(packagePath);
const nextVersion = incrementPatch(packageJson.version);
const buildTime = new Date().toISOString();

if (process.argv.includes('--dry-run')) {
  console.log(`Next version would be v${nextVersion} (${buildTime})`);
  process.exit(0);
}

packageJson.version = nextVersion;
const packageLock = readJson(lockPath);
packageLock.version = nextVersion;
if (packageLock.packages?.['']) {
  packageLock.packages[''].version = nextVersion;
}

const versionInfo = { version: nextVersion, buildTime };
writeJson(packagePath, packageJson);
writeJson(lockPath, packageLock);
writeJson(frontendVersionPath, versionInfo);
writeJson(backendVersionPath, versionInfo);

console.log(`Prepared version v${nextVersion} (${buildTime})`);
