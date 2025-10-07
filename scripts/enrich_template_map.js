const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const mapPath = path.join(projectRoot, 'views', 'templates-map.json');
if (!fs.existsSync(mapPath)) { console.error('Missing', mapPath); process.exit(1); }
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

function readFile(p) { return fs.readFileSync(p, 'utf8').split(/\r?\n/); }

Object.keys(map.templates).forEach(tid => {
  const tpl = map.templates[tid];
  tpl.references = tpl.references.map(ref => {
    if (ref.type !== 'route/controller') return ref;
    const file = path.join(projectRoot, ref.file);
    if (!fs.existsSync(file)) return Object.assign(ref, { controller: null });
    const lines = readFile(file);
    // search around the line for controller: 'Name' or controller: "Name" or controller: Name
    const start = Math.max(0, ref.line - 10);
    const end = Math.min(lines.length, ref.line + 40);
    let controller = null;
    for (let i = start; i < end; i++) {
      const l = lines[i];
      // match controller: 'CtrlName' or controller: "CtrlName"
      let m = l.match(/controller\s*:\s*['\"]([^'\"]+)['\"]/);
      if (m) { controller = m[1]; break; }
      // match controller: CtrlName (no quotes)
      m = l.match(/controller\s*:\s*([A-Za-z0-9_\$]+)/);
      if (m) { controller = m[1]; break; }
      // also try inline .state('name', { controller: '...' }) previous lines
    }
    return Object.assign(ref, { controller });
  });
});

const outPath = path.join(projectRoot, 'views', 'templates-map-enriched.json');
fs.writeFileSync(outPath, JSON.stringify(map, null, 2), 'utf8');
console.log('Wrote', outPath);