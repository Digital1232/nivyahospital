const fs = require('fs');
const path = require('path');
const root = process.cwd();
const files = fs.readdirSync(root).filter((name) => name.toLowerCase().endsWith('.html'));
const snippetRaw = `				<li class="has-submenu megamenu">
					<a href="#" class="main-menu">Specialities </a>
					<ul class="submenu mega-submenu">
						<li>
							<div class="megamenu-wrapper megamenu-wrapper-one">
								<div class="row">
									<div class="col-lg-3 sub-menu-left">
										<ul class="sub-menu-list">
											<li><a href="pulmonology.html">Pulmonology</a></li>
											<li><a href="emergency-critical-care-medicine.html">Emergency &
												Critical Care Medicine</a></li>
											<li><a href="general-medicine.html">General Medicine</a></li>
											<li><a href="cardiology.html">Cardiology</a></li>
										</ul>
									</div>
									<div class="col-lg-3 sub-menu-left">
										<ul class="sub-menu-list">
											<li><a href="orthopaedics.html">Orthopaedics</a></li>
											<li><a href="dentistry.html">Dentistry</a></li>
											<li><a href="general-surgery.html">General Surgery</a></li>
											<li><a href="neurology.html">Neurology</a></li>
										</ul>
									</div>
									<div class="col-lg-3 sub-menu-left">
										<ul class="sub-menu-list">
											<li><a href="gastro-enterology.html">Gastro Enterology</a></li>
											<li><a href="radiology.html">Radiology</a></li>
											<li><a href="oncology.html">Oncology</a></li>
											<li><a href="psychiatry.html">Psychiatry</a></li>
										</ul>
									</div>
								</div>
							</div>
						</li>
					</ul>
				</li>`;

function findSpecialitiesBlock(html) {
  const start = html.indexOf('<li class="has-submenu megamenu">');
  if (start === -1) return null;
  const regex = /<\/?li\b[^>]*>/gi;
  regex.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (match[0].startsWith('</')) {
      depth -= 1;
    } else {
      depth += 1;
    }
    if (depth === 0) {
      return { start, end: regex.lastIndex };
    }
  }
  return null;
}

let updatedCount = 0;
files.forEach((file) => {
  const filePath = path.join(root, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const bounds = findSpecialitiesBlock(content);
  if (!bounds) return;
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const snippet = snippetRaw.replace(/\n/g, newline);
  if (content.slice(bounds.start, bounds.end) === snippet) return;
  const updated = content.slice(0, bounds.start) + snippet + content.slice(bounds.end);
  fs.writeFileSync(filePath, updated, 'utf8');
  updatedCount += 1;
  console.log(`Replaced specialities menu in ${file}`);
});
console.log(`Completed; updated ${updatedCount} files.`);
