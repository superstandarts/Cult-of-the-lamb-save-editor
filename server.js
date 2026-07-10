const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { LambMPDecoder } = require('lamb-mp-decoder');

const app = express();
const HOST = '127.0.0.1';
const PORT = 41731;
let activeFolder = '';
let activeFile = '';

app.use(express.json({ limit: '30mb' }));

let sea = null;
try {
  const seaModule = require('node:sea');
  if (seaModule.isSea()) sea = seaModule;
} catch {}

if (sea) {
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    const key = req.path === '/' ? 'public/index.html' : `public${req.path}`;
    try {
      const asset = Buffer.from(sea.getAsset(key));
      res.type(path.extname(key) || '.html').send(asset);
    } catch {
      next();
    }
  });
} else {
  app.use(express.static(path.join(__dirname, 'public')));
}

function allowedFileName(name) {
  return /^(slot|meta)_\d+\.(mp|json)$/i.test(name) || /^(persistence|settings)\.json$/i.test(name);
}

async function lz4Decompress(input, originalSize) {
  const mod = await import('@addmaple/lz4/inline');
  return mod.decompressBlock(input, originalSize);
}

async function decodeSave(filePath) {
  const raw = await fsp.readFile(filePath);
  if (raw[0] === 0x7b) return JSON.parse(raw.toString('utf8'));
  const decoder = new LambMPDecoder({
    decrypt: async (key, iv, data) => {
      const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(key), Buffer.from(iv));
      return Buffer.concat([decipher.update(Buffer.from(data)), decipher.final()]);
    },
    decompress: lz4Decompress
  });
  return (await decoder.readSave(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))).data;
}

function encodeLegacyJson(data) {
  const key = crypto.randomBytes(16);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  const body = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(data), 'utf8')), cipher.final()]);
  return Buffer.concat([Buffer.from('E'), key, iv, body]);
}

function assertFolder(folder) {
  const resolved = path.resolve(folder || '');
  if (!activeFolder || resolved !== activeFolder) throw new Error('The selected save folder does not match the current session.');
  return resolved;
}

async function listSlots(folder) {
  const names = await fsp.readdir(folder);
  const ids = new Set();
  for (const name of names) {
    const match = name.match(/^slot_(\d+)\.(?:mp|json)$/i);
    if (match) ids.add(Number(match[1]));
  }
  return [...ids].sort((a, b) => a - b).map(id => ({
    id,
    hasMp: names.some(n => n.toLowerCase() === `slot_${id}.mp`),
    hasJson: names.some(n => n.toLowerCase() === `slot_${id}.json`)
  }));
}

app.post('/api/select-file', async (req, res) => {
  try {
    let file = String(req.body.path || '').trim().replace(/^"|"$/g, '');
    if (!file && process.platform === 'win32') {
      const script = "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Title='Select your Cult of the Lamb save'; $d.Filter='Cult of the Lamb saves (slot_*.mp;slot_*.json)|slot_*.mp;slot_*.json|All files|*.*'; if($d.ShowDialog() -eq 'OK'){Write-Output $d.FileName}";
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-STA', '-Command', script]);
      file = stdout.trim();
    }
    if (!file) throw new Error('No file was selected.');
    const resolved = path.resolve(file);
    const stat = await fsp.stat(resolved);
    if (!stat.isFile()) throw new Error('The selected path is not a file.');
    const match = path.basename(resolved).match(/^slot_(\d+)\.(mp|json)$/i);
    if (!match) throw new Error('Select a slot_#.mp or slot_#.json file.');
    activeFile = resolved;
    activeFolder = path.dirname(resolved);
    res.json({ ok: true, folder: activeFolder, file: activeFile, slot: Number(match[1]), source: path.basename(resolved) });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

app.get('/api/load/:slot', async (req, res) => {
  try {
    const folder = assertFolder(req.query.folder);
    const slot = Number(req.params.slot);
    if (!Number.isInteger(slot) || slot < 0 || slot > 99) throw new Error('Invalid save slot.');
    const selectedMatch = path.basename(activeFile).match(/^slot_(\d+)\./i);
    const source = selectedMatch && Number(selectedMatch[1]) === slot ? activeFile : '';
    if (!fs.existsSync(source)) throw new Error('Save file not found.');
    const data = await decodeSave(source);
    res.json({ ok: true, data, source: path.basename(source), fields: Object.keys(data).length });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

app.post('/api/save/:slot', async (req, res) => {
  try {
    const folder = assertFolder(req.body.folder);
    const slot = Number(req.params.slot);
    if (!req.body.data || typeof req.body.data !== 'object' || Array.isArray(req.body.data)) throw new Error('Invalid save data.');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(folder, 'RageEditorBackups', `slot_${slot}_${stamp}`);
    await fsp.mkdir(backupDir, { recursive: true });
    const names = await fsp.readdir(folder);
    const relevant = names.filter(n => allowedFileName(n) && (n.match(new RegExp(`^(slot|meta)_${slot}\\.`, 'i')) || /^(persistence|settings)\.json$/i.test(n)));
    for (const name of relevant) await fsp.copyFile(path.join(folder, name), path.join(backupDir, name));
    const target = path.join(folder, `slot_${slot}.json`);
    const temp = `${target}.rage.tmp`;
    await fsp.writeFile(temp, encodeLegacyJson(req.body.data));
    await decodeSave(temp); // validates encryption and JSON before touching the active save
    await fsp.rename(temp, target);
    const mp = path.join(folder, `slot_${slot}.mp`);
    if (fs.existsSync(mp)) await fsp.unlink(mp);
    res.json({ ok: true, backup: backupDir, target, note: 'The game will import the JSON and recreate the .mp file.' });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

app.post('/api/restore', async (req, res) => {
  try {
    const folder = assertFolder(req.body.folder);
    const backup = path.resolve(String(req.body.backup || ''));
    const root = path.join(folder, 'RageEditorBackups') + path.sep;
    if (!backup.startsWith(root)) throw new Error('Invalid backup.');
    const files = await fsp.readdir(backup);
    for (const name of files.filter(allowedFileName)) await fsp.copyFile(path.join(backup, name), path.join(folder, name));
    res.json({ ok: true });
  } catch (error) { res.status(400).json({ ok: false, error: error.message }); }
});

app.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`Cotl Save Editor by Rage: ${url}`);
  const command = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  execFile(command[0], command[1], () => {});
});
