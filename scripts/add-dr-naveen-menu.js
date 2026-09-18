const fs = require("fs");

const files = fs.readdirSync(".").filter(f => f.endsWith(".html"));
let updated = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, "utf8");
  const target = `<li><a href="doctor-mathan-profile.html">Dr. M.A. Mathan</a></li>`;
  const addition = `<li><a href="doctor-mathan-profile.html">Dr. M.A. Mathan</a></li>\n\t\t\t\t\t\t\t\t<li><a href="doctor-naveen-paul-profile.html">Dr. Naveen Paul Singh</a></li>`;
  
  if (content.includes(target) && !content.includes("doctor-naveen-paul-profile.html")) {
    content = content.replaceAll(target, addition);
    fs.writeFileSync(file, content, "utf8");
    updated++;
    console.log("Updated:", file);
  }
});

console.log("Total updated files:", updated);
