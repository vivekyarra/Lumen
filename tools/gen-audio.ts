// Renders Lumen's sound cues to WAV files for Lens Studio: npm run gen:audio
import { mkdirSync, writeFileSync } from "node:fs";
import { CUE_IDS, encodeWav, renderCue } from "../Assets/Lumen/Core/SoundGen";

const dir = "Assets/Lumen/Audio";
mkdirSync(dir, { recursive: true });
for (const id of CUE_IDS) {
  const file = `${dir}/lumen_${id}.wav`;
  writeFileSync(file, encodeWav(renderCue(id)));
  console.log("wrote", file);
}
