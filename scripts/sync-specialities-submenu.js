const fs = require('fs');
const path = require('path');

const root = process.cwd();
const snippetLines = [
  '                        <li class="has-submenu active">',
  '                            <a href="#" class="main-menu">Specialities </a>',
  '                            <ul class="submenu mega-submenu">',
  '                                <li>',
  '                                    <div class="megamenu-wrapper megamenu-wrapper-one">',
  '                                        <div class="row">',
  '                                            <div class="col-lg-3 sub-menu-left">',
  '                                                <ul class="sub-menu-list">',
  '                                                    <li><a href="pulmonology.html">Pulmonology</a></li>',
  '                                                    <li><a href="emergency-critical-care-medicine.html">Emergency &',
  '                                                            Critical Care Medicine</a></li>',
  '                                                    <li><a href="general-medicine.html">General Medicine</a></li>',
  '                                                    <li><a href="cardiology.html">Cardiology</a></li>',
  '                                                </ul>',
  '                                            </div>',
  '                                            <div class="col-lg-3 sub-menu-left">',
  '                                                <ul class="sub-menu-list">',
  '                                                    <li><a href="orthopaedics.html">Orthopaedics</a></li>',
  '                                                    <li><a href="dentistry.html">Dentistry</a></li>',
  '                                                    <li><a href="general-surgery.html">General Surgery</a></li>',
  '                                                    <li><a href="neurology.html">Neurology</a></li>',
  '                                                </ul>',
  '                                            </div>',
  '                                            <div class="col-lg-3 sub-menu-left">',
  '                                                <ul class="sub-menu-list">',
  '                                                    <li><a href="gastro-enterology.html">Gastro Enterology</a></li>',
  '                                                    <li><a href="radiology.html">Radiology</a></li>',
  '                                                    <li><a href="oncology.html">Oncology</a></li>',
  '                                                    <li><a href="psychiatry.html">Psychiatry</a></li>',
  '                                                </ul>',
  '                                            </div>',
  '                                            <div class="col-lg-3 sub-menu-left">',
  '                                                <ul class="sub-menu-list">',
  '                                                    <li><a href="nutrition-obesity-clinic.html">Nutrition & Obesity',
  '                                                            Clinic</a></li>',
  '                                                    <li><a href="nephrology.html">Nephrology</a></li>',
  '                                                    <li><a href="urology.html">Urology</a></li>',
  '                                                    <li><a href="search.html">All Specialities</a></li>',
  '                                                </ul>',
  '                                            </div>',
  '                                        </div>',
  '                                    </div>',
  '                                </li>',
  '                            </ul>',
  '                        </li>',
];

function findSpecialitiesEnd(html, start) {
  const regex = /<\/li>|<li\b/gi;
  regex.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const token = html.slice(match.index, match.index + match[0].length);
    if (token.startsWith('</li')) {
      depth -= 1;
    } else {
      depth += 1;
    }
    if (depth === 0) {
      return regex.lastIndex;
    }
  }
  return -1;
}

function syncFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const anchor = content.indexOf('<a href="#" class="main-menu">Specialities');
  if (anchor === -1) {
    return null;
  }
  const start = content.lastIndexOf('<li', anchor);
  if (start === -1) {
    return null;
  }
  const end = findSpecialitiesEnd(content, start);
  if (end === -1) {
    return null;
  }

  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const snippet = newline + snippetLines.join(newline) + newline;
  const updated = content.slice(0, start) + snippet + content.slice(end);
  return updated;
}

const files = fs.readdirSync(root).filter((file) => file.toLowerCase().endsWith('.html'));
let updated = 0;
for (const file of files) {
  const filePath = path.join(root, file);
  const result = syncFile(filePath);
  if (!result) {
    continue;
  }
  fs.writeFileSync(filePath, result, 'utf8');
  console.log(`Updated specialities menu in ${file}`);
  updated += 1;
}
console.log(`Finished; updated ${updated} files.`);
