// Build static, crawlable articles and both blog indexes from one content file.
// Run from the repository root: node scripts/build-health-blog.js
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const posts = require('./health-blog-content.json');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = '2026-10-28';
const displayDate = '28 October 2026';
const site = 'https://nivyahospital.vercel.app/';
const header = read('blog-grid.html').match(/<header\b[\s\S]*?<\/header>/)[0]
  .replace(/^[\t ]+/gm, indent => indent.replace(/\t/g, '    '))
  .replace(/[\t ]+$/gm, '');
const footer = read('index.html').match(/<footer\b[\s\S]*?<\/footer>/)[0];
const categories = [...new Map(posts.map(p => [p.categorySlug,p.category])).entries()];
const minutes = p => Math.max(1, Math.ceil([p.intro,...p.sections.flatMap(s=>[s.heading,...(s.paragraphs||[]),...(s.list||[])])].join(' ').split(/\s+/).length / 200));
const image = (p, extra='') => `<img src="${esc(p.image)}" alt="${esc(p.alt)}" width="1200" height="800" ${extra}>`;

function sidebar(current) {
  const related = posts.filter(p=>p.file!==current).slice(0,3);
  return `<aside class="col-lg-4 health-sidebar" aria-label="Blog navigation">
    <div class="health-panel"><h2>Find an article</h2>
      <form action="blog-grid.html" method="get" class="health-search" role="search" data-blog-search>
        <label for="blog-search">Search health topics</label>
        <div class="health-search-row"><input id="blog-search" name="q" type="search" placeholder="Try asthma or sleep" maxlength="100"><button type="submit" aria-label="Search articles"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></button></div>
      </form>
    </div>
    <div class="health-panel"><h2>Browse by specialty</h2><ul class="health-categories">
      <li><a href="blog-grid.html">All articles <span>${posts.length}</span></a></li>
      ${categories.map(([slug,name])=>`<li><a href="blog-grid.html?category=${esc(slug)}">${esc(name)} <span>${posts.filter(p=>p.categorySlug===slug).length}</span></a></li>`).join('\n')}
    </ul></div>
    <div class="health-panel"><h2>More to read</h2><ul class="health-related">
      ${related.map(p=>`<li><a href="${p.file}">${image(p,'loading="lazy" decoding="async"')}<span>${esc(p.title)}</span></a></li>`).join('\n')}
    </ul></div>
    <div class="health-panel health-help"><span class="health-eyebrow">Nivya Hospitals, Tirunelveli</span><h2>Have a health concern?</h2><p>Explore our specialists or call the hospital to discuss an appointment.</p><a class="btn btn-primary-gradient" href="search.html">Find a specialist</a><a class="health-phone" href="tel:+919566443300">+91 95664 43300</a></div>
  </aside>`;
}

function card(p, list) {
  return `<article class="health-card${list?' health-card-list':''}" data-blog-card data-category="${p.categorySlug}" data-search="${esc([p.title,p.category,p.excerpt].join(' '))}">
    <a class="health-card-image" href="${p.file}" tabindex="-1" aria-hidden="true">${image(p,'loading="lazy" decoding="async"')}</a>
    <div class="health-card-body"><span class="health-category">${esc(p.category)}</span><h2><a href="${p.file}">${esc(p.title)}</a></h2><p>${esc(p.excerpt)}</p><div class="health-meta"><time datetime="${date}">${displayDate}</time><span>${minutes(p)} min read</span></div><a class="health-read-link" href="${p.file}" aria-label="Read ${esc(p.title)}">Read article <span aria-hidden="true">&rarr;</span></a></div>
  </article>`;
}

function shell({file,title,description,imagePath,content,article,bodyTitle}) {
  const structured = article ? {
    '@context':'https://schema.org','@type':'BlogPosting',headline:article.title,description:article.excerpt,image:site+article.image,datePublished:date,dateModified:date,
    author:{'@type':'Organization',name:'Nivya Hospitals'},publisher:{'@type':'Organization',name:'Nivya Respiratory and Multispeciality Hospitals',logo:{'@type':'ImageObject',url:site+'assets/img/logo-white.png'}},
    mainEntityOfPage:site+file,articleSection:article.category,inLanguage:'en-IN',citation:article.sources.map(s=>s.url)
  } : {'@context':'https://schema.org','@type':'CollectionPage',name:title,description,url:site+file,inLanguage:'en-IN'};
  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} | Nivya Hospitals, Tirunelveli</title>
  <meta name="description" content="${esc(description)}"><meta name="author" content="Nivya Hospitals">
  <link rel="canonical" href="${site+file}">
  <meta property="og:type" content="${article?'article':'website'}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${site+file}"><meta property="og:image" content="${site+imagePath}"><meta property="og:site_name" content="Nivya Hospitals">
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${site+imagePath}">
  <link rel="shortcut icon" href="assets/img/favicon.png" type="image/x-icon"><link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
  <script src="assets/js/theme-script.js"></script>
  <link rel="stylesheet" href="assets/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"><link rel="stylesheet" href="assets/css/iconsax.css"><link rel="stylesheet" href="assets/css/feather.css"><link rel="stylesheet" href="assets/css/style.css"><link rel="stylesheet" href="assets/css/health-blog.css">
  <script type="application/ld+json">${JSON.stringify(structured).replace(/</g,'\\u003c')}</script>
</head><body class="theme-1"><div class="main-wrapper">
${header}
<main class="health-blog" id="main-content">
  <section class="health-banner"><div class="container"><nav aria-label="Breadcrumb"><ol><li><a href="index.html">Home</a></li><li>${article?'<a href="blog-grid.html">Health &amp; Wellness</a>':'Health &amp; Wellness'}</li>${article?`<li aria-current="page">${esc(article.category)}</li>`:''}</ol></nav><span class="health-eyebrow">The Nivya health journal</span>${article?'<p class="health-banner-title">Understand your health. Make informed choices.</p>':`<h1>${esc(bodyTitle)}</h1><p>Practical information on breathing, everyday wellness and recognising when to seek care.</p>`}</div></section>
  ${content}
</main>
${footer}
</div>
<script src="assets/js/jquery-3.7.1.min.js"></script><script src="assets/js/bootstrap.bundle.min.js"></script><script src="assets/js/script.js"></script><script src="assets/js/health-blog.js" defer></script><script src="assets/js/chatbot.js"></script>
</body></html>\n`.replace(/[\t ]+$/gm, '');
}

for (const file of ['blog-grid.html','blog-list.html']) {
  const list = file==='blog-list.html';
  const content = `<section class="health-content"><div class="container"><div class="row g-4 g-xl-5"><div class="col-lg-8">
    <div class="health-index-top"><p data-blog-results role="status" aria-live="polite">${posts.length} articles for you and your family</p><div class="health-view-switch" aria-label="Article layout"><a href="blog-grid.html" ${!list?'aria-current="page"':''}>Grid</a><a href="blog-list.html" ${list?'aria-current="page"':''}>List</a></div></div>
    <div class="health-cards${list?' health-cards-list':''}" data-blog-index>${posts.map(p=>card(p,list)).join('\n')}</div>
    <div class="health-empty" data-blog-empty hidden><h2>No articles found</h2><p>Try a different word or browse all our health topics.</p><a class="btn btn-primary-gradient" href="${file}">View all articles</a></div>
    <p class="health-education-note">These articles provide general health information and do not replace a medical assessment or personalised treatment.</p>
  </div>${sidebar()}</div></div></section>`;
  fs.writeFileSync(path.join(root,file),shell({file,title:'Health & Wellness Blog',bodyTitle:'Health & Wellness',description:'Explore Nivya Hospitals health articles on asthma, persistent cough, diabetes, heart health, stroke warning signs and sleep apnoea in Tirunelveli.',imagePath:posts[0].image,content}));
}

for (const p of posts) {
  const content=`<section class="health-content"><div class="container"><div class="row g-4 g-xl-5"><div class="col-lg-8">
    <article class="health-article"><header class="health-article-header"><span class="health-category">${esc(p.category)}</span><h1>${esc(p.title)}</h1><p class="health-article-deck">${esc(p.excerpt)}</p><div class="health-meta"><span>Nivya Hospitals &middot; Patient education</span><time datetime="${date}">${displayDate}</time><span>${minutes(p)} min read</span></div></header>
    <figure class="health-article-image">${image(p,'fetchpriority="high"')}${p.image.includes('/generated/')?'<figcaption>Illustrative image</figcaption>':''}</figure>
    <div class="health-article-copy"><p class="health-intro">${esc(p.intro)}</p>
    ${p.alert?`<aside class="health-alert" aria-label="When to seek urgent help"><h2>When it should not wait</h2><p>${esc(p.alert)}</p></aside>`:''}
    <nav class="health-toc" aria-label="In this article"><h2>In this article</h2><ol>${p.sections.map((s,i)=>`<li><a href="#section-${i+1}">${esc(s.heading)}</a></li>`).join('')}</ol></nav>
    ${p.sections.map((s,i)=>`<section id="section-${i+1}"><h2>${esc(s.heading)}</h2>${(s.paragraphs||[]).map(t=>`<p>${esc(t)}</p>`).join('')}${s.list?`<ul>${s.list.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}</section>`).join('\n')}
    <section class="health-sources" aria-label="Article sources"><h2>Sources &amp; further reading</h2><p>Patient information checked against these public health resources on ${displayDate}.</p><ul>${p.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} <span class="visually-hidden">(opens in a new tab)</span></a></li>`).join('')}</ul></section>
    <p class="health-education-note">This article is for general health awareness. It does not diagnose a condition or replace advice from a qualified clinician. Do not change prescribed treatment based on an online article.</p>
    <aside class="health-article-cta"><span class="health-eyebrow">Care at Nivya Hospitals</span><h2>Speak with the right specialist</h2><p>Find out more about our ${esc(p.specialty)} services in Vannarpettai, Tirunelveli.</p><div><a class="btn btn-primary-gradient" href="${p.specialtyPage}">Explore ${esc(p.specialty)}</a><a class="health-text-link" href="search.html">Choose a doctor &rarr;</a></div></aside>
    </div></article><a class="health-back-link" href="blog-grid.html">&larr; Back to all health articles</a>
  </div>${sidebar(p.file)}</div></div></section>`;
  fs.writeFileSync(path.join(root,p.file),shell({file:p.file,title:p.title,description:p.excerpt,imagePath:p.image,content,article:p}));
}
console.log(`Built ${posts.length} articles and 2 indexes.`);
