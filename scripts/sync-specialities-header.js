const fs = require('fs');
const path = require('path');

const root = process.cwd();
const referenceFile = path.join(root, 'index.html');
const specialities = [
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
].map((name) => name.toLowerCase());

function findHeaderBounds(html) {
  const start = html.indexOf('<header class="header header-default">');
  if (start === -1) return null;
  const end = html.indexOf('</header>', start);
  if (end === -1) return null;
  return { start, end: end + '</header>'.length };
}

if (!fs.existsSync(referenceFile)) {
  console.error(`Reference file not found: ${referenceFile}`);
  process.exit(1);
}

const referenceContent = fs.readFileSync(referenceFile, 'utf8');
const referenceBounds = findHeaderBounds(referenceContent);
if (!referenceBounds) {
  console.error('Could not locate header in reference file.');
  process.exit(1);
}

const referenceHeader = referenceContent.slice(referenceBounds.start, referenceBounds.end);
let updatedCount = 0;

for (const fileName of specialities) {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping missing file: ${fileName}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const bounds = findHeaderBounds(content);
  if (!bounds) {
    console.warn(`Header not found in ${fileName}`);
    continue;
  }

  const currentHeader = content.slice(bounds.start, bounds.end);
  if (currentHeader === referenceHeader) {
    continue;
  }

  const updated = content.slice(0, bounds.start) + referenceHeader + content.slice(bounds.end);
  fs.writeFileSync(filePath, updated);
  updatedCount += 1;
  console.log(`Synced header for ${fileName}`);
}

console.log(`Finished syncing ${updatedCount} specialities.`);
