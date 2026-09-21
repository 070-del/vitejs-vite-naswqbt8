import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Only this verification bundle starts at the reported result. App source/defaults stay intact.
const points = [{x:0,y:0},{x:2000,y:0},{x:2000,y:2300},{x:3900,y:2300},{x:3900,y:700},{x:6000,y:700},{x:6000,y:5200},{x:0,y:5200}];
const dims = {A:2000,B:2300,C:1900,D:1600,E:2100,F:4500,G:6000,H:5200};
const previewSettings = process.argv.includes('--rockwool')
  ? {barPitch:364,barW:1820,barType:'岩綿',centerBarType:'double',screwSpec:'general'}
  : process.argv.includes('--square')
  ? {barPitch:303,barW:910,barType:'3×3ジプトーン',centerBarType:'double',screwSpec:'general'}
  : {barPitch:227,barW:455,barType:'1.5×3ジプトーン',centerBarType:'double',screwSpec:'general'};
let source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  .replace('useState(1)', 'useState(3)')
  .replace('useState(makeShape(defaultPoints))', `useState(makeShape(${JSON.stringify(points)}))`)
  .replace('const [dims, setDims] = useState({})', `const [dims, setDims] = useState(${JSON.stringify(dims)})`)
  .replace('const [resultDiagramPage, setResultDiagramPage] = useState(0)', `const [resultDiagramPage, setResultDiagramPage] = useState(${process.argv.includes('--rockwool') ? 0 : 1})`)
  .replace(/const \[settings, setSettings\] = useState\(\{[\s\S]*?\}\);/, `const [settings, setSettings] = useState(${JSON.stringify(previewSettings)});`);
source += '\nimport React from "react"; import {createRoot} from "react-dom/client"; createRoot(document.getElementById("root")).render(<App/>);';
await build({stdin:{contents:source,loader:'jsx',resolveDir:fileURLToPath(new URL('../src',import.meta.url))},bundle:true,format:'esm',outdir:fileURLToPath(new URL('../dist/board-preview',import.meta.url)),entryNames:'app',define:{'process.env.NODE_ENV':'"development"'}});
console.log('Preview ready: /board-preview.html');
