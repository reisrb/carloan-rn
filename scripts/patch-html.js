const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../dist/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const inject = `
<link rel="apple-touch-icon" href="/icon-apple.png" />
<link rel="manifest" href="/manifest.json" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="CarLoan" />`;

html = html.replace('</head>', inject + '\n</head>');
fs.writeFileSync(htmlPath, html);
