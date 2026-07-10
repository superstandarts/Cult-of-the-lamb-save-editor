const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const bundle = path.join(dist, 'cotl-save-editor.bundle.cjs');
const configPath = path.join(dist, 'sea-config.json');
const blob = path.join(dist, 'cotl-save-editor.blob');
const output = path.join(dist, 'Cotl-Save-Editor-by-Rage.exe');
const runtime = path.join(dist, 'rage-node-runtime.exe');
const icon = path.join(root, 'rage-logo.ico');
const bundleOnly = process.argv.includes('--bundle-only');

function log(message) {
  console.log(`\x1b[36m[RAGE BUILD]\x1b[0m ${message}`);
}

function ensureBuildDependencies() {
  try {
    require.resolve('esbuild');
    require.resolve('postject');
    require.resolve('rcedit');
  } catch {
    log('Build dependencies are missing. Running npm install...');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    execFileSync(npm, ['install'], { cwd: root, stdio: 'inherit' });
  }
}

function collectAssets(directory, prefix = 'public') {
  const assets = {};
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const key = `${prefix}/${entry.name}`.replace(/\\/g, '/');
    if (entry.isDirectory()) Object.assign(assets, collectAssets(absolute, key));
    else assets[key] = absolute;
  }
  return assets;
}

function supportsDirectSea() {
  try {
    return execFileSync(process.execPath, ['--help'], { encoding: 'utf8' }).includes('--build-sea');
  } catch {
    return false;
  }
}

async function prepareWindowsRuntime() {
  fs.copyFileSync(process.execPath, runtime);
  if (!fs.existsSync(icon)) {
    log('rage-logo.ico was not found. The default Node icon will be used.');
    return runtime;
  }
  log('Applying the RAGE icon before SEA injection...');
  const { rcedit } = require('rcedit');
  await rcedit(runtime, {
    icon,
    'file-version': '1.0.0',
    'product-version': '1.0.0',
    'version-string': {
      CompanyName: 'Rage',
      FileDescription: 'Cult of the Lamb Save Editor by Rage',
      ProductName: 'Cotl Save Editor by Rage',
      LegalCopyright: 'Copyright Rage',
      OriginalFilename: 'Cotl-Save-Editor-by-Rage.exe'
    }
  });
  return runtime;
}

async function build() {
  ensureBuildDependencies();
  const esbuild = require('esbuild');
  fs.mkdirSync(dist, { recursive: true });
  log('Bundling the server and dependencies...');
  await esbuild.build({
    entryPoints: [path.join(root, 'server.js')],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    minify: true,
    sourcemap: false,
    legalComments: 'none'
  });

  if (bundleOnly) {
    log(`Bundle test completed: ${path.relative(root, bundle)}`);
    return;
  }
  if (process.platform !== 'win32') throw new Error('The .exe build must be run on Windows.');

  const assets = collectAssets(path.join(root, 'public'));
  const direct = supportsDirectSea();
  const preparedRuntime = await prepareWindowsRuntime();
  const config = {
    main: bundle,
    mainFormat: 'commonjs',
    output: direct ? output : blob,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
    assets,
    ...(direct ? { executable: preparedRuntime } : {})
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  if (direct) {
    log('Creating the executable with the built-in Node SEA builder...');
    execFileSync(process.execPath, ['--build-sea', configPath], { stdio: 'inherit' });
  } else {
    log('Creating the SEA preparation blob...');
    execFileSync(process.execPath, ['--experimental-sea-config', configPath], { stdio: 'inherit' });
    fs.copyFileSync(preparedRuntime, output);
    log('Injecting the application into the Windows executable...');
    const postject = require.resolve('postject/dist/cli.js');
    execFileSync(process.execPath, [
      postject, output, 'NODE_SEA_BLOB', blob,
      '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
      '--overwrite'
    ], { stdio: 'inherit' });
  }

  if (!fs.existsSync(output)) throw new Error('The executable was not created.');
  try { fs.unlinkSync(runtime); } catch {}
  const megabytes = (fs.statSync(output).size / 1024 / 1024).toFixed(1);
  log(`Done: ${path.relative(root, output)} (${megabytes} MB)`);
  log('You can now copy this single .exe to another Windows computer.');
}

build().catch((error) => {
  console.error(`\x1b[31m[RAGE BUILD ERROR]\x1b[0m ${error.message}`);
  process.exit(1);
});
