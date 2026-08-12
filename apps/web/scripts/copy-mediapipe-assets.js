/**
 * Copies the @mediapipe/tasks-vision wasm fileset (a transitive dependency of
 * @livekit/track-processors) into public/mediapipe/wasm so the video-call
 * virtual background loads same-origin instead of from the jsdelivr CDN.
 * Runs via the prebuild/predev npm hooks. The segmentation model
 * (selfie_segmenter.tflite) is small and committed directly in public/.
 */
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const webRoot = path.join(__dirname, '..');
const destDir = path.join(webRoot, 'public', 'mediapipe', 'wasm');

const tpPkg = createRequire(path.join(webRoot, 'package.json'))
  .resolve('@livekit/track-processors/package.json');
// tasks-vision's exports map hides package.json — resolve its main entry and
// walk up to the package root.
const mpMain = createRequire(tpPkg).resolve('@mediapipe/tasks-vision');
let pkgRoot = path.dirname(mpMain);
while (path.basename(pkgRoot) !== 'tasks-vision' && pkgRoot !== path.dirname(pkgRoot)) {
  pkgRoot = path.dirname(pkgRoot);
}
const wasmDir = path.join(pkgRoot, 'wasm');

fs.mkdirSync(destDir, { recursive: true });
let copied = 0;
for (const f of fs.readdirSync(wasmDir)) {
  if (!/\.(js|wasm)$/.test(f)) continue;
  fs.copyFileSync(path.join(wasmDir, f), path.join(destDir, f));
  copied++;
}
console.log(`[mediapipe-assets] copied ${copied} wasm files -> public/mediapipe/wasm`);
