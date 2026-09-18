const fs = require('fs');
const templatePath = 'pulmonology.html';
const template = fs.readFileSync(templatePath, 'utf8');

const specialties = [
  {
    slug: 'emergency-critical-care-medicine',
    pageName: 'Emergency & Critical Care Medicine',
    heroTitle: 'EMERGENCY & CRITICAL CARE MEDICINE',
    heroTagline: '24/7 Life-Saving Care When Every Second Counts',
    heroDescription:
      'Our Emergency & Critical Care department is equipped to handle all medical emergencies with speed and precision. Available round-the-clock, we ensure immediate medical attention and advanced care for critical conditions.',
    sectionTitle: 'Services We Offer',
    sectionList: [
      'Trauma & Accident Care',
      'Cardiac Emergencies',
      'Stroke Management',
      'Intensive Care Unit (ICU) Support',
      'Ventilator & Life Support Systems'
    ],
    advancedHeading: 'Advanced Care Approach',
    advancedParagraph: 'Rapid diagnosis, immediate stabilization, and continuous monitoring using advanced ICU technologies.',
    patientHeading: 'Patient-Centered Care',
    patientParagraph: 'We provide compassionate support to patients and families during critical moments.',
    whyHeading: 'Why Choose Us',
    whyItems: ['24/7 emergency services', 'Advanced ICU facilities', 'Skilled critical care team', 'Fast response time'],
    introParagraph:
      'Our Emergency & Critical Care department is equipped to handle all medical emergencies with speed and precision. Available round-the-clock, we ensure immediate medical attention and advanced care for critical conditions.',
    keywords: ['emergency care', 'critical care', 'ICU', 'trauma']
  },
  {
    slug: 'general-medicine',
    pageName: 'General Medicine',
    heroTitle: 'GENERAL MEDICINE',
    heroTagline: 'Comprehensive Healthcare for Everyday Wellness',
    heroDescription:
      'Our General Medicine department provides holistic care for a wide range of medical conditions with a focus on prevention and long-term health management.',
    sectionTitle: 'Conditions We Treat',
    sectionList: ['Fever & Infections', 'Diabetes & Hypertension', 'Thyroid Disorders', 'Lifestyle Diseases', 'Viral Illnesses'],
    advancedHeading: 'Advanced Care Approach',
    advancedParagraph: 'Early diagnosis, preventive screenings and personalized treatment plans.',
    patientHeading: 'Patient-Centered Care',
    patientParagraph: 'Continuous monitoring and lifestyle guidance for better health outcomes.',
    whyHeading: 'Why Choose Us',
    whyItems: ['Experienced physicians', 'Preventive care focus', 'Personalized treatments', 'Long-term care support'],
    introParagraph:
      'Our General Medicine department provides holistic care for a wide range of medical conditions with a focus on prevention and long-term health management.',
    keywords: ['general medicine', 'prevention', 'lifestyle', 'wellness']
  },
  {
    slug: 'cardiology',
    pageName: 'Cardiology',
    heroTitle: 'CARDIOLOGY',
    heroTagline: 'Complete Heart Care for a Healthier Life',
    heroDescription:
      'Our Cardiology department offers expert care for heart conditions with advanced diagnostics and preventive strategies.',
    sectionTitle: 'Conditions We Treat',
    sectionList: ['Coronary Artery Disease', 'Heart Attack', 'Arrhythmias', 'Hypertension', 'Heart Failure'],
    advancedHeading: 'Advanced Care Approach',
    advancedParagraph: 'Modern diagnostic tools and evidence-based treatment plans.',
    patientHeading: 'Patient-Centered Care',
    patientParagraph: 'Focus on prevention through lifestyle guidance and regular monitoring.',
    whyHeading: 'Why Choose Nivya',
    whyItems: ['Expert cardiologists', 'Advanced cardiac care', 'Preventive focus', 'Patient-first approach'],
    introParagraph:
      'Our Cardiology department offers expert care for heart conditions with advanced diagnostics and preventive strategies.',
    keywords: ['cardiology', 'heart care', 'arrhythmia', 'hypertension']
  },
  {
    slug: 'orthopaedics',
    pageName: 'Orthopaedics',
    heroTitle: 'ORTHOPAEDICS',
    heroTagline: 'Restoring Mobility, Enhancing Life',
    heroDescription:
      'Our Orthopaedics department specializes in treating musculoskeletal conditions, helping patients regain strength and mobility.',
    sectionTitle: 'Conditions We Treat',
    sectionList: ['Fractures & Injuries', 'Arthritis', 'Joint Pain', 'Sports Injuries', 'Spine Disorders'],
    advancedHeading: 'Advanced Care Approach',
    advancedParagraph: 'Combination of surgical and non-surgical treatments including rehabilitation.',
    patientHeading: 'Patient-Centered Care',
    patientParagraph: 'Customized care plans focused on recovery and mobility.',
    whyHeading: 'Why Choose Us',
    whyItems: ['Skilled orthopaedic surgeons', 'Advanced treatment techniques', 'Faster recovery programs', 'Rehabilitation support'],
    introParagraph:
      'Our Orthopaedics department specializes in treating musculoskeletal conditions, helping patients regain strength and mobility.',
    keywords: ['orthopaedics', 'joint care', 'sports injury', 'spine']
  },
  {
    slug: 'dentistry',
    pageName: 'Dentistry',
    heroTitle: 'DENTISTRY',
    heroTagline: 'Complete Dental Care for Healthy Smiles',
    heroDescription: 'We provide a full range of dental services to maintain oral health and enhance your smile.',
    sectionTitle: 'Services We Offer',
    sectionList: ['General Dentistry', 'Cosmetic Dentistry', 'Root Canal Treatment', 'Tooth Extraction', 'Gum Care'],
    advancedHeading: 'Advanced Care Approach',
    advancedParagraph: 'Minimally invasive and patient-friendly procedures.',
    patientHeading: 'Patient-Centered Care',
    patientParagraph: 'Focus on hygiene, comfort and preventive dental care.',
    whyHeading: 'Why Choose Us',
    whyItems: ['Experienced dentists', 'Hygienic environment', 'Advanced dental care', 'Personalized treatments'],
    introParagraph: 'We provide a full range of dental services to maintain oral health and enhance your smile.',
    keywords: ['dentistry', 'cosmetic dentistry', 'root canal', 'oral health']
  },
  {
    slug: 'nephrology',
    pageName: 'Nephrology',
    heroTitle: 'NEPHROLOGY',
    heroTagline: 'Specialized Kidney Care',
    heroDescription: 'Our Nephrology department provides expert care for kidney-related conditions with advanced treatment options.',
    sectionTitle: 'Conditions We Treat',
    sectionList: ['Chronic Kidney Disease', 'Kidney Failure', 'Electrolyte Imbalances', 'Dialysis Care'],
    advancedHeading: 'Our Approach',
    advancedParagraph: 'We focus on early diagnosis, disease management and patient education for better kidney health.',
    patientHeading: 'Patient-Centered Care',
    patientParagraph: 'Lifestyle guidance and continuous monitoring.',
    whyHeading: 'Why Choose Us',
    whyItems: ['Expert nephrologists', 'Advanced dialysis facilities', 'Comprehensive care', 'Continuous monitoring'],
    introParagraph: 'Our Nephrology department provides expert care for kidney-related conditions with advanced treatment options.',
    keywords: ['nephrology', 'kidney care', 'dialysis', 'electrolyte']
  },
  {
    slug: 'general-surgery',
    pageName: 'General Surgery',
    heroTitle: 'GENERAL SURGERY',
    heroTagline: 'Safe & Advanced Surgical Care',
    heroDescription:
      'Our General Surgery department offers a wide range of surgical procedures with modern techniques and high safety standards.',
    sectionTitle: 'Procedures We Perform',
    sectionList: ['Laparoscopic Surgeries', 'Hernia Repair', 'Appendix Surgery', 'Gallbladder Surgery'],
    advancedHeading: 'Our Approach',
    advancedParagraph: 'Minimally invasive techniques ensure faster recovery and reduced discomfort.',
    patientHeading: 'Patient-Centered Care',
    patientParagraph: 'Complete pre- and post-operative support.',
    whyHeading: 'Why Choose Us',
    whyItems: ['Skilled surgeons', 'Modern operation theatres', 'Safe surgical practices', 'Post-operative care'],
    introParagraph:
      'Our General Surgery department offers a wide range of surgical procedures with modern techniques and high safety standards.',
    keywords: ['surgery', 'laparoscopic', 'hernia', 'gallbladder']
  },
  {
    slug: 'neurology',
    pageName: 'Neurology',
    heroTitle: 'NEUROLOGY',
    heroTagline: 'Specialized Care for Brain & Nervous System',
    heroDescription: 'Our Neurology department treats complex neurological conditions with precision and expertise.',
    sectionTitle: 'Conditions We Treat',
    sectionList: ['Stroke', 'Epilepsy', 'Migraine', 'Neuropathy', 'Parkinson’s Disease'],
    advancedHeading: 'Our Approach',
    advancedParagraph: 'Advanced diagnostics and expert care ensure accurate treatment and improved outcomes.',
    patientHeading: 'Patient-Centered Care',
    patientParagraph: 'Continuous monitoring and rehabilitation support.',
    whyHeading: 'Why Choose Us',
    whyItems: ['Experienced neurologists', 'Advanced diagnostic tools', 'Personalized care', 'Continuous monitoring'],
    introParagraph: 'Our Neurology department treats complex neurological conditions with precision and expertise.',
    keywords: ['neurology', 'stroke', 'epilepsy', 'Parkinson']
  },
  {
    slug: 'gastro-enterology',
    pageName: 'Gastro Enterology',
    heroTitle: 'GASTRO ENTEROLOGY',
    heroTagline: 'Complete Digestive Care',
    heroDescription: 'Our Gastroenterology department focuses on diagnosing and treating digestive system disorders.',
    sectionTitle: 'Conditions We Treat',
    sectionList: ['Acid Reflux', 'Liver Diseases', 'Gastritis', 'Ulcers', 'Digestive Disorders'],
    advancedHeading: 'Our Approach',
    advancedParagraph:
      'We combine advanced diagnostics with effective treatment plans for long-term digestive health.',
    patientHeading: 'Patient-Centered Care',
    patientParagraph: 'Diet and lifestyle guidance for long-term health.',
    whyHeading: 'Why Choose Us',
    whyItems: ['Expert specialists', 'Advanced procedures', 'Patient-friendly care', 'Accurate diagnosis'],
    introParagraph: 'Our Gastroenterology department focuses on diagnosing and treating digestive system disorders.',
    keywords: ['gastroenterology', 'digestive health', 'liver', 'ulcer']
  },
  {
    slug: 'radiology',
    pageName: 'Radiology',
    heroTitle: 'RADIOLOGY',
    heroTagline: 'Accurate Diagnosis Starts Here',
    heroDescription: 'Our Radiology department provides high-quality imaging services for precise diagnosis.',
    sectionTitle: 'Services We Offer',
    sectionList: ['X-Ray', 'Ultrasound', 'CT Scan', 'Diagnostic Imaging'],
    advancedHeading: 'Our Approach',
    advancedParagraph: 'Fast, accurate imaging supports effective treatment decisions.',
    patientHeading: 'Patient-Centered Care',
    patientParagraph: 'Quick and reliable reporting.',
    whyHeading: 'Why Choose Us',
    whyItems: ['Advanced equipment', 'Quick reports', 'Skilled technicians', 'Reliable diagnostics'],
    introParagraph: 'Our Radiology department provides high-quality imaging services for precise diagnosis.',
    keywords: ['radiology', 'imaging', 'CT scan', 'ultrasound']
  },
  {
    slug: 'oncology',
    pageName: 'Oncology',
    heroTitle: 'ONCOLOGY',
    heroTagline: 'Comprehensive Cancer Care with Compassion',
    heroDescription: 'We provide complete cancer care with a focus on early detection and advanced treatment.',
    sectionTitle: 'Services We Offer',
    sectionList: ['Cancer Screening', 'Diagnosis', 'Treatment Planning', 'Supportive Care'],
    advancedHeading: 'Our Approach',
    advancedParagraph:
      'A multidisciplinary approach ensures the best possible care and support for patients.',
    patientHeading: 'Patient-Centered Care',
    patientParagraph: 'Compassionate care. Patient support programs.',
    whyHeading: 'Why Choose Us',
    whyItems: ['Experienced oncologists', 'Advanced treatments', 'Compassionate care', 'Patient support programs'],
    introParagraph: 'We provide complete cancer care with a focus on early detection and advanced treatment.',
    keywords: ['oncology', 'cancer care', 'supportive care', 'multidisciplinary']
  },
  {
    slug: 'psychiatry',
    pageName: 'Psychiatry',
    heroTitle: 'PSYCHIATRY',
    heroTagline: 'Mental Health Care You Can Trust',
    heroDescription:
      'Our Psychiatry department offers confidential and compassionate care for mental health conditions.',
    sectionTitle: 'Conditions We Treat',
    sectionList: ['Anxiety', 'Depression', 'Stress Disorders', 'Sleep Disorders'],
    advancedHeading: 'Our Approach',
    advancedParagraph:
      'We focus on holistic mental wellness through therapy, counseling, and medical treatment.',
    patientHeading: 'Patient-Centered Care',
    patientParagraph: 'Confidential and compassionate support.',
    whyHeading: 'Why Choose Us',
    whyItems: ['Experienced psychiatrists', 'Confidential care', 'Personalized therapy', 'Supportive environment'],
    introParagraph:
      'Our Psychiatry department offers confidential and compassionate care for mental health conditions.',
    keywords: ['psychiatry', 'mental health', 'therapy', 'counseling']
  },
  {
    slug: 'nutrition-obesity-clinic',
    pageName: 'Nutrition & Obesity Clinic',
    heroTitle: 'NUTRITION & OBESITY CLINIC',
    heroTagline: 'Your Journey to a Healthier Life',
    heroDescription: 'We provide personalized nutrition and weight management programs.',
    sectionTitle: 'Services We Offer',
    sectionList: ['Diet Planning', 'Weight Loss Programs', 'Lifestyle Counseling', 'Obesity Management'],
    advancedHeading: 'Advanced Care Approach',
    advancedParagraph: 'Science-based personalized nutrition strategies.',
    patientHeading: 'Patient-Centered Care',
    patientParagraph: 'Continuous guidance and follow-up.',
    whyHeading: 'Why Choose Us',
    whyItems: ['Expert nutritionists', 'Personalized programs', 'Lifestyle-focused care', 'Long-term results'],
    introParagraph: 'We provide personalized nutrition and weight management programs.',
    keywords: ['nutrition', 'weight loss', 'obesity management', 'lifestyle']
  },
  {
    slug: 'urology',
    pageName: 'Urology',
    heroTitle: 'UROLOGY',
    heroTagline: 'Advanced Urological Care',
    heroDescription:
      'Our Urology department specializes in treating urinary and reproductive health conditions.',
    sectionTitle: 'Conditions We Treat',
    sectionList: ['Kidney Stones', 'Urinary Infections', 'Prostate Disorders', 'Male Infertility'],
    advancedHeading: 'Our Approach',
    advancedParagraph:
      'Advanced diagnostics and minimally invasive treatments ensure effective care.',
    patientHeading: 'Patient-Centered Care',
    patientParagraph: 'Comfort, privacy, and personalized treatment.',
    whyHeading: 'Why Choose Us',
    whyItems: ['Experienced urologists', 'Modern technology', 'Minimally invasive procedures', 'Patient-focused care'],
    introParagraph:
      'Our Urology department specializes in treating urinary and reproductive health conditions.',
    keywords: ['urology', 'kidney stones', 'infertility', 'urinary health']
  }
];

const patterns = {
  heroDesc: /<p class="hero-description mb-5">[\s\S]*?<\/p>/,
  metaDesc: /<meta name="description"[\s\S]*?content="[^"]*">/,
  metaKeywords: /<meta name="keywords" content="[^"]*">/,
  ogTitle: /<meta property="og:title" content="[^"]*">/,
  ogUrl: /<meta property="og:url" content="[^"]*">/,
  ogDesc: /<meta property="og:description"[\s\S]*?content="[^"]*">/,
  twitterTitle: /<meta name="twitter:title" content="[^"]*">/,
  twitterDesc: /<meta name="twitter:description"[\s\S]*?content="[^"]*">/,
  twitterUrl: /<meta property="twitter:url" content="[^"]*">/,
  aboutList: /<div class="mt-4">\s*<ul class="about-list-two">[\s\S]*?<\/div>/,
  advancedBlock: /<div class="mt-3">\s*<h2>Advanced Diagnostic & <br> Treatment Approach<\/h2>[\s\S]*?<\/div>/,
  patientBlock: /<div class="mt-3">\s*<h2>Patient-Centered Care<\/h2>[\s\S]*?<\/div>/,
  whyRow: /<div class="row g-3 mt-4 why-choose-grid">[\s\S]*?<\/div>/,
  whyHeading: /<h2>Why Choose Nivya<\/h2>/
};

function replaceOnce(content, pattern, replacement) {
  const match = pattern.exec(content);
  if (!match) {
    throw new Error('Pattern not found: ' + pattern);
  }
  return content.replace(pattern, replacement);
}

function buildAboutList(items) {
  let html = '            <div class="mt-4">\n                <ul class="about-list-two">\n';
  items.forEach((item) => {
    html += `                    <li>${item}</li>\n`;
  });
  html += '                </ul>\n            </div>';
  return html;
}

function buildWhyGrid(items) {
  let html = '                        <div class="row g-3 mt-4 why-choose-grid">\n';
  items.forEach((item) => {
    html += '                            <div class="col-md-6 col-lg-3">\n';
    html += '                                <div class="why-choose-card">\n';
    html += `                                    <p>${item}</p>\n`;
    html += '                                </div>\n';
    html += '                            </div>\n';
  });
  html += '                        </div>';
  return html;
}

specialties.forEach((spec) => {
  let content = template;
  const pageTitle = `${spec.pageName} | Nivya Respiratory and Multispeciality Hospitals`;
  const metaDescription = spec.heroDescription;
  const keywords = spec.keywords.join(', ');
  const ogUrl = `https://nivyahospitals.com/${spec.slug}.html`;

  content = content.replace('Pulmonology | Nivya Respiratory and Multispeciality Hospitals', pageTitle);
  content = replaceOnce(content, patterns.metaDesc, `<meta name="description" content="${metaDescription}">`);
  content = replaceOnce(content, patterns.metaKeywords, `<meta name="keywords" content="${keywords}">`);
  content = replaceOnce(content, patterns.ogTitle, `<meta property="og:title" content="${pageTitle}">`);
  content = replaceOnce(content, patterns.ogUrl, `<meta property="og:url" content="${ogUrl}">`);
  content = replaceOnce(content, patterns.ogDesc, `<meta property="og:description" content="${metaDescription}">`);
  content = replaceOnce(content, patterns.twitterTitle, `<meta name="twitter:title" content="${pageTitle}">`);
  content = replaceOnce(content, patterns.twitterDesc, `<meta name="twitter:description" content="${metaDescription}">`);
  content = replaceOnce(content, patterns.twitterUrl, `<meta property="twitter:url" content="${ogUrl}">`);

  content = content.replace(
    '<h1 class="hero-title">Advanced Respiratory Care for Healthier Living</h1>',
    `<h1 class="hero-title">${spec.heroTitle}</h1>`
  );

  const heroFull = `${spec.heroTagline}<br>${spec.heroDescription}`;
  content = replaceOnce(content, patterns.heroDesc, `<p class="hero-description mb-5">${heroFull}</p>`);
  content = content.replace('alt="Pulmonology care setup"', `alt="${spec.heroTitle} care setup"`);

  content = content.replace('<h2>Conditions We Treat</h2>', `<h2>${spec.sectionTitle}</h2>`);
  content = replaceOnce(content, patterns.aboutList, buildAboutList(spec.sectionList));

  content = replaceOnce(
    content,
    patterns.advancedBlock,
    `                            <div class="mt-3">\n                                <h2>${spec.advancedHeading}</h2>\n                                <p>${spec.advancedParagraph}</p>\n                            </div>`
  );
  content = replaceOnce(
    content,
    patterns.patientBlock,
    `                            <div class="mt-3">\n                                <h2>${spec.patientHeading}</h2>\n                                <p>${spec.patientParagraph}</p>\n                            </div>`
  );

  content = replaceOnce(content, patterns.whyHeading, `<h2>${spec.whyHeading}</h2>`);
  content = replaceOnce(content, patterns.whyRow, buildWhyGrid(spec.whyItems));

  content = replaceOnce(content, /<title>.*?<\/title>/, `<title>${pageTitle}</title>`);

  const outputPath = `${spec.slug}.html`;
  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`Generated ${outputPath}`);
});
