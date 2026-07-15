const fs = require('fs');
let content = fs.readFileSync('prisma/schema.prisma', 'utf-8');
content = content.replace(/model\s+([A-Za-z0-9_]+)\s*\{([^}]*)\}/g, (match, modelName, body) => {
  if (body.includes('@@map')) return match;
  let mapStatement = `\n  @@map("${modelName.toLowerCase()}")\n`;
  return `model ${modelName} {${body.replace(/\s+$/, '')}${mapStatement}}`;
});
fs.writeFileSync('prisma/schema.prisma', content);
console.log('Done');
