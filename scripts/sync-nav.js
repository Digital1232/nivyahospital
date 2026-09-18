const fs = require('fs');
const path = require('path');

const root = process.cwd();
const indexPath = path.join(root, 'index.html');
const specialitiesPages = new Set([
  'pulmonology.html',
  'emergency-critical-care-medicine.html',
  'general-medicine.html',
  'cardiology.html',
  'orthopaedics.html',
  'dentistry.html',
  'general-surgery.html',
  'neurology.html',
  'gastro-enterology.html',
  'radiology.html',
  'oncology.html',
  'psychiatry.html',
  'nutrition-obesity-clinic.html',
  'nephrology.html',
  'urology.html',
  'speciality.html',
].map((name) => name.toLowerCase()));

function findNavBounds(html) {
  const start = html.indexOf('<ul class="main-nav">');
  if (start === -1) {
    return null;
  }

  const regex = /<\/?ul\b[^>]*>/gi;
  regex.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const tag = match[0];
    if (tag.startsWith('</')) {
      depth -= 1;
    } else {
      depth += 1;
    }

    if (depth === 0) {
      return { start, end: match.index + tag.length };
    }
  }

  return null;
}

if (!fs.existsSync(indexPath)) {
  console.error('index.html not found at', indexPath);
  process.exit(1);
}

const indexContent = fs.readFileSync(indexPath, 'utf8');
const indexNavBounds = findNavBounds(indexContent);
if (!indexNavBounds) {
  console.error('Could not locate navigation block in index.html');
  process.exit(1);
}

const baseNav = indexContent.slice(indexNavBounds.start, indexNavBounds.end);
const specialitiesNav = baseNav.replace(
  /<li class="has-submenu megamenu">(\s*<a href="#" class="main-menu">Specialities)/,
  '<li class="has-submenu megamenu active">$1'
);

const htmlFiles = fs
  .readdirSync(root)
  .filter((name) => path.extname(name).toLowerCase() === '.html');

let updatedCount = 0;

for (const file of htmlFiles) {
  const filePath = path.join(root, file);
  const htmlContent = fs.readFileSync(filePath, 'utf8');
  const bounds = findNavBounds(htmlContent);
  if (!bounds) {
    continue;
  }

  const preferSpecialities = specialitiesPages.has(file.toLowerCase());
  const navToInsert = preferSpecialities ? specialitiesNav : baseNav;
  const currentNav = htmlContent.slice(bounds.start, bounds.end);
  if (currentNav === navToInsert) {
    continue;
  }

  const updated = htmlContent.slice(0, bounds.start) + navToInsert + htmlContent.slice(bounds.end);
  fs.writeFileSync(filePath, updated);
  updatedCount += 1;
  console.log(`Updated navigation for ${file}`);
}

console.log(`Finished. Updated ${updatedCount} file(s).`);
