const fs=require('fs');
const content=fs.readFileSync('psychiatry.html','utf8');
const needle='Advanced respiratory diagnostics';
const idx=content.indexOf(needle);
console.log(JSON.stringify(content.slice(idx-5, idx+needle.length+400)));
