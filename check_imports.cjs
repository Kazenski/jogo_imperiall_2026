const fs = require('fs');
const files = fs.readdirSync('src').filter(f => f.endsWith('.js'));
files.forEach(f => {
  const content = fs.readFileSync('src/' + f, 'utf8');
  if (content.includes("from '../ui/comuns'") || content.includes("from './comuns'") || content.includes("comuns.js")) {
    console.log(f + ' imports comuns.js');
  }
});