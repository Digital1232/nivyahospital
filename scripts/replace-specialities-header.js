const fs = require('fs');
const path = require('path');

const root = process.cwd();
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
];

const snippet = `<!-- Header -->
\t<header class="header header-default">
\t\t<div class="container">
\t\t\t<nav class="navbar navbar-expand-lg header-nav">
\t\t\t\t<div class="navbar-header">
\t\t\t\t\t<a id="mobile_btn" href="javascript:void(0);">
\t\t\t\t\t\t<i class="fa-solid fa-bars"></i>
\t\t\t\t\t</a>
\t\t\t\t\t<a href="index.html" class="navbar-brand logo">
\t\t\t\t\t\t<img src="assets/img/logo copy.png" class="img-fluid normal-logo" alt="Logo">
\t\t\t\t\t</a>
\t\t\t\t</div>
\t\t\t\t<div class="main-menu-wrapper">
\t\t\t\t\t<div class="menu-header">
\t\t\t\t\t\t<a href="index-2.html" class="menu-logo">
\t\t\t\t\t\t\t<img src="assets/img/logo-02.svg" class="img-fluid" alt="Logo">
\t\t\t\t\t\t</a>
\t\t\t\t\t\t<a id="menu_close" class="menu-close" href="javascript:void(0);">
\t\t\t\t\t\t\t<i class="fas fa-times"></i>
\t\t\t\t\t\t</a>
\t\t\t\t\t</div>
\t\t\t\t\t<ul class="main-nav">
\t\t\t\t\t\t<li class="has-submenu ">
\t\t\t\t\t\t\t<a href="index.html">Home</a>
\t\t\t\t\t\t</li>
\t\t\t\t\t\t<li><a href="about-us.html">About Us</a></li>
\t\t\t\t\t\t<li class="has-submenu">
\t\t\t\t\t\t\t<a href="javascript:void(0);">Doctors </a>
\t\t\t\t\t\t\t<ul class="submenu">
\t\t\t\t\t\t\t\t<li><a href="search.html">Doctors List</a></li>
\t\t\t\t\t\t\t\t<li><a href="doctor-manimozhiyan-profile.html">Dr. P. Manimozhian</a></li>
\t\t\t\t\t\t\t\t<li><a href="doctor-nivya-profile.html">Dr. M. Nivya</a></li>
\t\t\t\t\t\t\t\t<li><a href="doctor-mathan-profile.html">Dr. M.A. Mathan</a></li>
\t\t\t\t\t\t\t</ul>
\t\t\t\t\t\t</li>
\n+\t                  <li class="has-submenu megamenu active">
\t\t\t<a href="#" class="main-menu">Specialities </a>
\t\t\t<ul class="submenu mega-submenu">
\t\t\t\t<li>
\t\t\t\t\t<div class="megamenu-wrapper megamenu-wrapper-one">
\t\t\t\t\t\t<div class="row">
\t\t\t\t\t\t\t<div class="col-lg-3 sub-menu-left">
\t\t\t\t\t\t\t\t<ul class="sub-menu-list">
\t\t\t\t\t\t\t\t\t<li><a href="pulmonology.html">Pulmonology</a></li>
\t\t\t\t\t\t\t\t\t<li><a href="emergency-critical-care-medicine.html">Emergency &
\t\t\t\t\t\t\t\t\t\tCritical Care Medicine</a></li>
\t\t\t\t\t\t\t\t\t<li><a href="general-medicine.html">General Medicine</a></li>
\t\t\t\t\t\t\t\t\t<li><a href="cardiology.html">Cardiology</a></li>
\t\t\t\t\t\t\t\t</ul>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<div class="col-lg-3 sub-menu-left">
\t\t\t\t\t\t\t\t<ul class="sub-menu-list">
\t\t\t\t\t\t\t\t\t<li><a href="orthopaedics.html">Orthopaedics</a></li>
\t\t\t\t\t\t\t\t\t<li><a href="dentistry.html">Dentistry</a></li>
\t\t\t\t\t\t\t\t\t<li><a href="general-surgery.html">General Surgery</a></li>
\t\t\t\t\t\t\t\t\t<li><a href="neurology.html">Neurology</a></li>
\t\t\t\t\t\t\t\t</ul>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<div class="col-lg-3 sub-menu-left">
\t\t\t\t\t\t\t\t<ul class="sub-menu-list">
\t\t\t\t\t\t\t\t\t<li><a href="gastro-enterology.html">Gastro Enterology</a></li>
\t\t\t\t\t\t\t\t\t<li><a href="radiology.html">Radiology</a></li>
\t\t\t\t\t\t\t\t\t<li><a href="oncology.html">Oncology</a></li>
\t\t\t\t\t\t\t\t\t<li><a href="psychiatry.html">Psychiatry</a></li>
\t\t\t\t\t\t\t\t</ul>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>
\t\t\t\t</li>
\t\t\t</ul>
\t\t\t</li>
\n+\t\t\t\t\t<li>
\t\t\t\t\t\t<a href="blog-grid.html">Blog</a>
\t\t\t\t\t</li>
\t\t\t\t\t<li>
\t\t\t\t\t\t<a href="contact-us.html">Contact Us</a>
\t\t\t\t\t</li>
\t\t\t\t</ul>
\t\t\t\t</li>
\n+\t\t\t\t<div class="header-items">
\t\t\t\t\t<!-- Item 1 -->
\t\t\t\t\t<div class="about-popup-item border-0 pb-0">
\t\t\t\t\t\t<h3 class="title">Contact Information</h3>
\t\t\t\t\t\t<div class="support-item mb-3">
\t\t\t\t\t\t\t<div class="avatar avatar-lg bg-primary rounded-circle">
\t\t\t\t\t\t\t	<i class="isax isax-messages-3"></i>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<div>
\t\t\t\t\t\t\t\t<p class="title">General Inquiries</p>
\t\t\t\t\t\t\t\t<h5 class="link"><a
\t\t\t\t\t\t\t\t\thref="https://doccure.dreamstechnologies.com/cdn-cgi/l/email-protection"
\t\t\t\t\t\t\t\t\tclass="__cf_email__"
\t\t\t\t\t\t\t\t\tdata-cfemail="127b7c747d52776a737f627e773c717d7f">[email&#160;protected]</a>
\t\t\t\t\t\t\t\t</h5>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<div class="support-item">
\t\t\t\t\t\t\t<div class="avatar avatar-lg bg-primary rounded-circle">
\t\t\t\t\t\t\t	<i class="isax isax-call-calling"></i>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<div>
\t\t\t\t\t\t\t\t<p class="title">Emergency Cases</p>
\t\t\t\t\t\t\t\t<h5 class="link">+1 24565 89856</h5>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>
\t\t\t\t		<!-- Item 2 -->
\t\t\t\t		<div class="about-popup-item border-0 pb-0">
\t\t\t\t			<h3 class="title">Follow Us</h3>
\t\t\t\t			<ul class="d-flex align-items-center gap-2 social-iyem">
\t\t\t\t				<li>
\t\t\t\t					<a href="javascript:void(0);" class="social-icon"><i
\t\t\t\t					class="fa-brands fa-facebook"></i></a>
\t\t\t\t				</li>
\t\t\t\t				<li>
\t\t\t\t					<a href="javascript:void(0);" class="social-icon"><i
\t\t\t\t					class="fa-brands fa-x-twitter"></i></a>
\t\t\t\t				</li>
\t\t\t\t				<li>
\t\t\t\t					<a href="javascript:void(0);" class="social-icon"><i
\t\t\t\t					class="fa-brands fa-instagram"></i></a>
\t\t\t\t				</li>
\t\t\t\t				<li>
\t\t\t\t					<a href="javascript:void(0);" class="social-icon"><i
\t\t\t\t					class="fa-brands fa-linkedin"></i></a>
\t\t\t\t				</li>
\t\t\t\t			</ul>
\t\t\t\t		</div>
\t\t\t\t	</div>
\t\t\t\t</div>
\t\t\t\t<ul class="nav header-navbar-rht">
\t\t\t\t	<li>
\t\t\t\t		<a href="search.html" class="btn btn-md btn-primary-gradient">
\t\t\t\t			<span>Book Appointment</span>
\t\t\t\t		</a>
\t\t\t\t	</li>
\t\t\t\t</ul>
\t\t\t</nav>
\t\t</div>
\t</header>
\t<!-- Header End -->`;

function findHeaderBounds(html) {
  const start = html.indexOf('<header class="header header-default">');
  if (start === -1) return null;
  const end = html.indexOf('</header>', start);
  if (end === -1) return null;
  return { start, end: end + '</header>'.length };
}

let updated = 0;

for (const page of specialities) {
  const filePath = path.join(root, page);
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf8');
  const bounds = findHeaderBounds(content);
  if (!bounds) continue;
  const updatedContent = content.slice(0, bounds.start) + snippet + content.slice(bounds.end);
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log(`Updated header in ${page}`);
  updated += 1;
}

console.log(`Headers replaced in ${updated} speciality pages.`);
