const fs = require('fs');
const path = require('path');

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

function walk(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      results.push(file);
    }
  });
  return results;
}

const projectRoot = path.resolve(__dirname, '..');
const viewsBase = path.join(projectRoot, 'views', 'base.jade');
if (!fs.existsSync(viewsBase)) {
  console.error('Cannot find views/base.jade at', viewsBase);
  process.exit(2);
}

const baseContent = readFile(viewsBase).split(/\r?\n/);

const templates = {};
for (let i = 0; i < baseContent.length; i++) {
  const line = baseContent[i];
  const match = line.match(/script\(type="text\/ng-template",\s*id=\s*"([^"]+)"\)/);
  if (match) {
    const id = match[1];
    // look ahead for an include line
    let includePath = null;
    for (let j = i+1; j < Math.min(i+6, baseContent.length); j++) {
      const incLine = baseContent[j].trim();
      const m = incLine.match(/^include\s+(.+)$/);
      if (m) {
        includePath = m[1].trim();
        break;
      }
    }
    templates[id] = {
      id,
      include: includePath || null,
      includedFrom: 'views/base.jade',
      references: []
    };
  }
}

// scan JS files for templateUrl occurrences
const jsRoot = path.join(projectRoot, 'public', 'resources', 'core', 'js');
let jsFiles = [];
if (fs.existsSync(jsRoot)) {
  jsFiles = walk(jsRoot).filter(p => p.endsWith('.js'));
}

const templateUrlRegex = /templateUrl\s*:\s*['\"]([^'\"]+)['\"]/g;
const templateUrlDynamicRegex = /templateUrl\s*:\s*([a-zA-Z0-9_\.]+)/g; // variable templateUrl

jsFiles.forEach(file => {
  const content = readFile(file).split(/\r?\n/);
  content.forEach((l, idx) => {
    let m;
    templateUrlRegex.lastIndex = 0;
    while ((m = templateUrlRegex.exec(l)) !== null) {
      const tid = m[1];
      if (!templates[tid]) {
        // create entry for templates referenced but not present in base.jade
        templates[tid] = { id: tid, include: null, includedFrom: null, references: [] };
      }
      templates[tid].references.push({ type: 'route/controller', file: path.relative(projectRoot, file), line: idx+1, text: l.trim() });
    }

    templateUrlDynamicRegex.lastIndex = 0;
    const dm = templateUrlDynamicRegex.exec(l);
    if (dm && !templateUrlRegex.test(l)) {
      // dynamic templateUrl usage
      const varName = dm[1];
      // record file as dynamic user
      Object.keys(templates).forEach(tid => {
        templates[tid].references.push({ type: 'directive-dynamic-template', file: path.relative(projectRoot, file), line: idx+1, text: l.trim() });
      });
    }

  });
});

// write JSON
const out = { generatedAt: (new Date()).toISOString(), templates };
const outPath = path.join(projectRoot, 'views', 'templates-map.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote', outPath);
