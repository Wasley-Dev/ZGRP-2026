const fs = require('fs');
const path = require('path');
const pngToIcoLib = require('png-to-ico');
const pngToIco = pngToIcoLib.default || pngToIcoLib;

async function main() {
  const argInput = process.argv[2];
  const argOutput = process.argv[3];
  const input = path.resolve(process.cwd(), argInput || path.join('assets', 'app-icon.png'));
  const output = path.resolve(process.cwd(), argOutput || path.join('assets', 'installer-icon.ico'));
  const buf = await pngToIco(input);
  fs.writeFileSync(output, buf);
  console.log(`Wrote ${output}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
