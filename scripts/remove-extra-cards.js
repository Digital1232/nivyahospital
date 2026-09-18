const fs = require('fs');
const path = require('path');
const root = process.cwd();
const specialities = [
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
];

const marker = 'Advanced respiratory diagnostics';

let cleaned = 0;

for (const file of specialities) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf8');
  const idx = content.indexOf(marker);
  if (idx === -1) continue;
  const start = content.lastIndexOf('<div class="col-md-6 col-lg-3">', idx);
  const end = content.indexOf('<div class="mt-4">', idx);
  if (start === -1 || end === -1 || end <= start) continue;
  const updated = content.slice(0, start) + content.slice(end);
  fs.writeFileSync(filePath, updated, 'utf8');
  console.log(`Pruned extra cards from ${file}`);
  cleaned += 1;
}

console.log(`Pruned ${cleaned} speciality pages.`);
