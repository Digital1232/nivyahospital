const fs=require('fs');
const content=fs.readFileSync('psychiatry.html','utf8');
const pattern=new RegExp('\s*<div class="col-md-6 col-lg-3">[\s\S]*?<p>Advanced respiratory diagnostics<\/p>[\s\S]*?<\/div>\s*','m');
console.log(pattern.test(content));
