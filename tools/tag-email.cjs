const fs = require('fs');
const files = [
  'src/components/SCTA.astro',
  'src/components/SiteFoot.astro',
  'src/components/SiteHead.astro',
  'src/pages/contact.astro',
  'src/pages/sponsor.astro',
];
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const re = /<a\s+([^>]*?)href="mailto:3992237161@qq\.com"([^>]*)>/g;
  let count = 0;
  s = s.replace(re, (m, pre, post) => {
    if (pre.includes('data-copy-email') || post.includes('data-copy-email')) return m;
    count++;
    return `<a ${pre}href="mailto:3992237161@qq.com"${post} data-copy-email>`;
  });
  fs.writeFileSync(f, s);
  console.log(f, 'tagged:', count);
}
