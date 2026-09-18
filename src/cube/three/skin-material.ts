/**
 * material ของคิวบ์ตามสกิน — ผิววัสดุ + ลวดลาย + เรืองแสง (ADR-087 ข้อ 2 · 4 · เฟส 13 ก้อนที่ 25)
 *
 * ยังเป็น **`MeshStandardMaterial` ตัวเดียวทั้งลูก** เหมือนเดิม (draw call ไม่เพิ่ม) — สกินที่มีลาย
 * ปะ shader ด้วย `onBeforeCompile` ให้อ่าน `patternUv` / `patternInfo` ที่ geometry ใส่ไว้
 * (`pattern-attributes.ts`) แล้ว:
 *
 *   สีสติกเกอร์  = vertex color × ค่าเทาของลาย            (เนื้อพลาสติกไม่รับลาย)
 *   ความหยาบผิว += (1 − ค่าเทา) × PATTERN_ROUGHNESS_SPREAD  (ส่วนมืดของลายด้าน ส่วนสว่างเงา)
 *   เรืองแสง    += vertex color × glow × ส่วนสว่างของลาย
 *
 * **ความหยาบตามลาย** ทำให้ลายเด่นขึ้นตอนรับแสง (ไฮไลต์ขึ้นแค่ส่วนที่เงา) โดยไม่ทำให้สีมืดลงอีก
 * — สีคือสิ่งที่ `verify-skins` คุมไว้ไม่ให้แยกกันไม่ออก ส่วนนี้ไม่แตะสีเลย
 *
 * `emissive` ของ Three.js เป็นสีเดียวทั้ง material จึงเรืองตามสีสติกเกอร์ไม่ได้ ต้องปะเอง
 *
 * สกิน `classic` **ไม่ปะอะไรเลย** — ภาพเหมือนก่อนมีสกินลวดลายทุกพิกเซล
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CubeSkin } from './colors.ts';
import { PATTERN_SIZE, PATTERN_TILE_WORLD, renderPattern } from './skin-patterns.ts';

/** ส่วนที่มืดที่สุดของลายหยาบขึ้นเท่านี้ (0–1) — ร่อง/เส้นดูด้าน เนื้อลายดูเงา */
const PATTERN_ROUGHNESS_SPREAD = 0.5;

/** ภาพโทนเทา → `DataTexture` (เก็บเป็น RGBA — ใช้ได้ทุก WebGL ไม่ต้องพึ่ง `RedFormat`) */
function grayTexture(gray: Uint8Array, size: number, anisotropy: number): THREE.DataTexture {
  const rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < gray.length; i++) {
    const value = gray[i]!;
    rgba[i * 4] = value;
    rgba[i * 4 + 1] = value;
    rgba[i * 4 + 2] = value;
    rgba[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(rgba, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // DataTexture ตั้งต้นเป็น Nearest + ไม่มี mipmap — ลายละเอียดจะกะพริบตอนคิวบ์เล็กบนจอ
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  // ค่าเทาเป็นตัวคูณตรง ๆ ไม่ใช่สี — ห้ามให้ three แปลง sRGB
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export interface SkinMaterial {
  material: THREE.MeshStandardMaterial;
  dispose(): void;
}

/**
 * @param maxAnisotropy ค่าสูงสุดที่การ์ดจอรองรับ (`renderer.capabilities.getMaxAnisotropy()`)
 *                      — ใช้ไม่เกิน 4 เพื่อไม่ให้มือถือหนัก (ADR-087 ข้อ 2)
 */
export function createSkinMaterial(skin: CubeSkin, maxAnisotropy: number): SkinMaterial {
  const { finish, pattern } = skin;
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: finish.roughness,
    metalness: finish.metalness,
    flatShading: true,
  });

  if (!pattern) {
    return { material, dispose: () => material.dispose() };
  }

  const patternMap = grayTexture(
    renderPattern(pattern),
    PATTERN_SIZE,
    Math.min(4, Math.max(1, maxAnisotropy)),
  );

  material.onBeforeCompile = (shader) => {
    shader.uniforms.patternMap = { value: patternMap };
    shader.uniforms.patternScale = { value: 1 / PATTERN_TILE_WORLD[pattern] };
    shader.uniforms.patternGlow = { value: finish.glow };
    shader.uniforms.patternRoughness = { value: PATTERN_ROUGHNESS_SPREAD };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec2 patternUv;
attribute vec3 patternInfo;
varying vec2 vPatternUv;
varying vec3 vPatternInfo;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
vPatternUv = patternUv;
vPatternInfo = patternInfo;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D patternMap;
uniform float patternScale;
uniform float patternGlow;
uniform float patternRoughness;
varying vec2 vPatternUv;
varying vec3 vPatternInfo;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// patternInfo = (โหมด, offset u, offset v) · โหมด 0 เนื้อพลาสติก · 1 สติกเกอร์
float patternOn = step(0.5, vPatternInfo.x);
float patternValue = mix(1.0, texture2D(patternMap, (vPatternUv + vPatternInfo.yz) * patternScale).r, patternOn);
diffuseColor.rgb *= patternValue;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (1.0 - patternValue) * patternRoughness, 0.04, 1.0);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
#ifdef USE_COLOR
totalEmissiveRadiance += vColor.rgb * patternGlow * patternOn * smoothstep(0.9, 1.0, patternValue);
#endif`,
      );
  };
  // shader ของแต่ละสกินต่างกันแค่ uniform แต่ให้ three แยก cache ไว้ กันไปหยิบโปรแกรมของ material อื่นมาใช้
  material.customProgramCacheKey = () => 'cubeduel-skin-pattern';

  return {
    material,
    dispose() {
      material.dispose();
      patternMap.dispose();
    },
  };
}

/**
 * environment map สำหรับผิวโลหะ (ADR-087 ข้อ 4) — สร้าง **ครั้งเดียวต่อ view** เฉพาะสกินที่ต้องใช้
 * โลหะที่ไม่มีอะไรให้สะท้อนจะออกมามืดเกือบดำ
 */
export function createEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const texture = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  return texture;
}
