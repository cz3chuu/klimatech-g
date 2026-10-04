// Składa kod do wklejenia w węzły Code n8n: rdzeń (core.js bez sekcji eksportu) + kod węzła.
// Użycie: node scripts/build-n8n.mjs  ->  n8n/dist/*.js
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
const core = readFileSync('n8n/src/core.js', 'utf8').split('// @@EXPORT')[0].trimEnd();
mkdirSync('n8n/dist', { recursive: true });
for (const f of readdirSync('n8n/src').filter((f) => f.endsWith('.glue.js'))) {
  const glue = readFileSync(`n8n/src/${f}`, 'utf8');
  // Rdzeń MUSI być przed kodem węzła (stałe `const` nie są hoistowane), a `return` na końcu.
  const out = `// WYGENEROWANE przez scripts/build-n8n.mjs – nie edytuj ręcznie, zmieniaj n8n/src/*\n// Kod konkretnego węzła jest NA DOLE pliku.\n\n${core}\n\n${glue}`;
  writeFileSync(`n8n/dist/${f.replace('.glue', '')}`, out);
  console.log('zbudowano', `n8n/dist/${f.replace('.glue', '')}`);
}
// Mniejsze węzły bez rdzenia są opisane w docs/n8n-workflows.md
