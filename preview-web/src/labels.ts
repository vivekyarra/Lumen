// Camera-facing text labels drawn to canvas textures. Sizes follow LUMEN_SPEC.md §8.6.
import * as THREE from "three";
import { wrapLabel, Align } from "../../Assets/Lumen/Core/ViewMath";

const PX_PER_CM = 40;
const FONT = '600 {px}px "Inter", "Segoe UI", system-ui, -apple-system, sans-serif';

export interface Label {
  object: THREE.Mesh;
  setText(text: string | null, color?: string): void;
  text: string | null;
  align: Align;
  /** Width/height in cm of the current text block. */
  sizeCm: { w: number; h: number };
}

/**
 * capCm = capital-letter height in cm. The mesh's origin is the bottom edge of the text block, and
 * `align` picks which horizontal edge sits on it.
 */
export function makeLabel(capCm: number, align: Align, wrapChars: number, plate?: boolean, overlay = true): Label {
  const emCm = capCm / 0.7;
  const fontPx = Math.round(emCm * PX_PER_CM);
  const lineCm = emCm * 1.15;
  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d")!;
  const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: !overlay, toneMapped: false });
  const geo = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = overlay ? 30 : 1;
  const label: Label = {
    object: mesh,
    text: null,
    align: align,
    sizeCm: { w: 0, h: 0 },
    setText(text: string | null, color?: string) {
      const c = color || "#FFFFFF";
      const key = text === null ? null : text + "|" + c;
      if ((mesh.userData.key || null) === key) return;
      mesh.userData.key = key;
      label.text = text;
      mesh.visible = text !== null;
      if (text === null) return;
      const lines = wrapLabel(text, wrapChars);
      canvas = document.createElement("canvas");
      ctx = canvas.getContext("2d")!;
      ctx.font = FONT.replace("{px}", String(fontPx));
      let wPx = 0;
      for (const l of lines) wPx = Math.max(wPx, ctx.measureText(l).width);
      const padPx = Math.round(fontPx * 0.25);
      canvas.width = Math.ceil(wPx + padPx * 2);
      canvas.height = Math.ceil(lines.length * lineCm * PX_PER_CM + padPx);
      ctx.font = FONT.replace("{px}", String(fontPx));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (plate) {
        ctx.strokeStyle = c;
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 3;
        ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = c;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = align === "right" ? "right" : align === "left" ? "left" : "center";
      const x = align === "right" ? canvas.width - padPx : align === "left" ? padPx : canvas.width / 2;
      for (let i = 0; i < lines.length; i++) {
        const baseline = padPx / 2 + (i + 0.8) * lineCm * PX_PER_CM;
        ctx.fillText(lines[i], x, baseline);
      }
      // WebGL2 textures are immutable in size: make a fresh texture whenever the text changes.
      if (mat.map) mat.map.dispose();
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      mat.map = tex;
      mat.needsUpdate = true;
      const wCm = canvas.width / PX_PER_CM;
      const hCm = canvas.height / PX_PER_CM;
      label.sizeCm = { w: wCm, h: hCm };
      mesh.geometry.dispose();
      const g = new THREE.PlaneGeometry(wCm, hCm);
      const dx = align === "right" ? -wCm / 2 : align === "left" ? wCm / 2 : 0;
      g.translate(dx, hCm / 2, 0);
      mesh.geometry = g;
    },
  };
  mesh.visible = false;
  return label;
}
