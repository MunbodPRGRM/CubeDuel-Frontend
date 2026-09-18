/**
 * เนื้อหาของโหมดฝึกสอนการใช้งาน
 *
 * 📕 นี่คือ **onboarding การใช้งานเว็บ/แอป ไม่ใช่การสอนวิธีแก้รูบิค** (CLAUDE.md ข้อ 5.2)
 * ทุกอย่างที่พูดถึงในนี้ต้องเป็นสิ่งที่ระบบทำได้จริงตอนนี้ — ห้ามโฆษณาของที่ยังไม่มี
 * ตัวเลขเวลาทั้งหมดอ้างจาก `docs/game-rules.md` (ข้อ 1–4) ถ้ากติกาเปลี่ยน ต้องมาแก้ไฟล์นี้ด้วย
 *
 * **ภาพหน้าจอจริง** อยู่ที่ `src/assets/tutorial/` (ADR-085 ข้อ 2) — แก้หน้าตาคอมโพเนนต์ที่อยู่ในภาพแล้วต้องถ่ายใหม่
 * (ขั้นตอนถ่ายอยู่ใน roadmap เฟส 13 ก้อนที่ 23) · ข้อความห้ามอ้างตำแหน่งบนจอ — จอกว้างกับจอแคบวางต่างกัน ให้อ้างชื่อปุ่ม
 */
import type { ReactNode } from 'react';
import shotControls from '@/assets/tutorial/controls.webp';
import shotCubeType from '@/assets/tutorial/cube-type.webp';
import shotModes from '@/assets/tutorial/modes.webp';
import shotScore from '@/assets/tutorial/score.webp';
import shotTimeline from '@/assets/tutorial/timeline.webp';
import { CubeLogo } from '@/components/CubeLogo';

export interface TutorialStep {
  /** ใช้เป็น React key และเป็นชื่อในการอ้างถึงเวลาคุยกัน */
  id: string;
  title: string;
  /** ย่อหน้าสั้น ๆ ใต้หัวข้อ */
  lead: string;
  /** ภาพหน้าจอจริง 960×600 — แสดงก่อน `visual` (ADR-085 ข้อ 2) · `alt` บอกว่าในภาพมีอะไร */
  image?: { src: string; alt: string };
  /** ภาพประกอบที่วาดด้วย HTML/SVG — ขั้นที่มีภาพหน้าจอใช้เสริมเฉพาะที่ภาพบอกไม่ได้ */
  visual?: ReactNode;
  /** ประเด็นย่อย บรรทัดละข้อ */
  points: string[];
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'ยินดีต้อนรับสู่ CubeDuel',
    lead: 'เกมแข่งบิดรูบิค 3 มิติแบบเรียลไทม์ — คู่มือนี้ใช้เวลาประมาณหนึ่งนาที',
    visual: (
      <div className="grid place-items-center py-2">
        <CubeLogo size={128} />
      </div>
    ),
    points: [
      'ข้ามได้ทุกเมื่อ แล้วกลับมาเปิดใหม่ได้จากปุ่ม ?',
      'ทุกอย่างในคู่มือนี้กดลองเองได้จากหน้าแรก',
    ],
  },
  {
    id: 'cube-type',
    title: 'เลือกประเภทรูบิคก่อนเล่นเสมอ',
    lead: 'มีให้เลือก 4 ประเภท และคะแนนแยกกันคนละชุด — เก่ง 3x3x3 ไม่ได้แปลว่าอันดับ Pyraminx สูงตาม',
    image: {
      src: shotCubeType,
      alt: 'ช่องเลือกประเภทรูบิคบนหน้าแรก กับการ์ดคะแนน ELO และอันดับของประเภทที่เลือก',
    },
    points: [
      'ช่องเลือกประเภทบนหน้าแรกคุมทั้งการจับคู่และตัวเลขสถิติที่หน้าแรกโชว์',
      'สถิติ กระดานอันดับ และคะแนน ELO ทุกที่ในเว็บเป็นของประเภทที่เลือกไว้เท่านั้น',
      'เปลี่ยนประเภทระหว่างรอคิวไม่ได้ ต้องกดยกเลิกคิวก่อน',
    ],
  },
  {
    id: 'modes',
    title: 'ห้องมี 4 แบบ เลือกตามที่อยากได้',
    lead: 'กดเลือกได้จากหน้าแรก — จับคู่ · ห้องหลายคน · ฝึกซ้อม · สร้างห้อง',
    image: {
      src: shotModes,
      alt: 'ปุ่มจับคู่ ห้องหลายคน ฝึกซ้อม สร้างห้อง และใส่เลขห้อง พร้อมคำอธิบายสั้นใต้แต่ละปุ่ม',
    },
    points: [
      'อยากลองระบบโดยไม่เสียคะแนน เริ่มที่ “ฝึกซ้อม” — ไม่ถูกบันทึกลงประวัติเลย',
      '“จับคู่” กับ “ห้องหลายคน” มีผลต่อคะแนน · “สร้างห้อง” แชร์รหัสให้เพื่อนและมีคนดูได้ แต่ไม่มีผลต่อคะแนน',
      'มีรหัสห้องจากเพื่อนแล้ว กด “ใส่เลขห้อง” ได้เลย',
    ],
  },
  {
    id: 'controls',
    title: 'บังคับคิวบ์ยังไง',
    lead: 'คิวบ์เป็นของ 3 มิติจริง ๆ ลากได้ทั้งตัวลูกและมุมกล้อง',
    image: { src: shotControls, alt: 'คิวบ์ 3x3x3 สามมิติที่ถูกสับแล้วในห้องฝึกซ้อม' },
    visual: (
      <div className="space-y-2 py-2">
        <ControlRow
          icon="✋"
          label="ลากบนตัวคิวบ์"
          desc="บิดชั้นนั้นตามนิ้ว — ลากหนึ่งครั้งได้หนึ่งช่วง 90°"
        />
        <ControlRow
          icon="🔄"
          label="ลากพื้นที่ว่างรอบคิวบ์"
          desc="หมุนมุมกล้องดูรอบ ๆ ทำได้ตลอดเวลาแม้ตอนห้ามบิด"
        />
        <ControlRow icon="🔍" label="ล้อเมาส์ หรือสองนิ้วบีบ/ถ่าง" desc="ซูมเข้าออก" />
      </div>
    ),
    points: [
      'Pyramorphix จะ “เปลี่ยนรูปทรง” หลังสับ — เป็นพฤติกรรมที่ถูกต้องของลูกนี้ ไม่ใช่ภาพเสีย',
      'ทุกครั้งที่บิด คู่แข่งจะเห็นแบบเรียลไทม์ และเซิร์ฟเวอร์เป็นคนตรวจว่าแก้เสร็จจริงไหม',
      'ลองมือได้ก่อนที่ห้อง “ฝึกซ้อม” — ไม่มีผลต่อคะแนน',
    ],
  },
  {
    id: 'timeline',
    title: 'ลำดับเวลาในห้องแข่ง',
    lead: 'ทุกคนในห้องเริ่มพร้อมกันเสมอ และเวลาที่ใช้ตัดสินเป็นของเซิร์ฟเวอร์',
    image: {
      src: shotTimeline,
      alt: 'scramble ของรอบ และตัวเลขนับถอยหลังช่วงตรวจสอบคิวบ์',
    },
    visual: (
      <div className="flex flex-wrap items-center justify-center gap-1.5 py-4 text-center text-xs">
        <Beat top="เตรียม" bottom="3 วิ" />
        <Arrow />
        <Beat top="ตรวจสอบคิวบ์" bottom="15 วิ" accent />
        <Arrow />
        <Beat top="จับเวลาจริง" bottom="บิดได้" />
        <Arrow />
        <Beat top="คนแรกเสร็จ" bottom="เหลือ 10 วิ" />
      </div>
    ),
    points: [
      'ช่วงตรวจสอบ 15 วินาที หมุนดูได้แต่บิดไม่ได้ · ทุกคนกด “พร้อม” ครบแล้วเริ่มก่อนเวลาได้ (ข้ามคนเดียวไม่ได้)',
      'พอมีคนแก้เสร็จคนแรก คนที่เหลือมีเวลาอีก 10 วินาที ไม่เสร็จถือเป็น DNF',
      'ออกจากห้องกลางคันหรือเน็ตหลุดยาว = แพ้ในรอบนั้น',
    ],
  },
  {
    id: 'score',
    title: 'คะแนน อันดับ และสถิติ',
    lead: 'ผลการแข่งในห้องที่มีผลคะแนนจะถูกบันทึกให้เองทุกนัด',
    image: {
      src: shotScore,
      alt: 'กระดานอันดับ แสดงอันดับ ชื่อผู้เล่น ผลแพ้ชนะ เวลาที่ดีที่สุด และคะแนน ELO โดยแถวของเราถูกไฮไลต์',
    },
    points: [
      'ทุกคนเริ่มที่ ELO 1000 ทุกประเภท · ชนะได้คะแนน แพ้เสียคะแนน — ปรับเฉพาะประเภทที่เพิ่งแข่ง',
      'กระดานอันดับมีแบบรายสัปดาห์ เริ่มนับใหม่ทุกวันจันทร์ · สถิติ Ao5 / Ao12 ดูได้ในหน้าโปรไฟล์',
      'ห้องฝึกซ้อมและห้องที่สร้างเองไม่มีผลต่อคะแนน',
    ],
  },
  {
    id: 'ready',
    title: 'พร้อมลงแข่งแล้ว',
    lead: 'กลับไปที่หน้าแรก เลือกประเภทรูบิค แล้วกด “จับคู่” ได้เลย',
    visual: (
      <div className="grid place-items-center py-5">
        <span className="rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/20">
          จับคู่
        </span>
      </div>
    ),
    points: [
      'แก้ชื่อเล่นได้ที่หน้าตั้งค่า · เลือกสกินสีคิวบ์ได้จากการ์ด “สกินคิวบ์” บนหน้าแรก',
      'เจอคนเล่นไม่ตรงไปตรงมา กดรายงานได้จากหน้าผลการแข่งขัน',
      'อยากอ่านคู่มือนี้ใหม่ กดปุ่ม ? ได้ตลอด',
    ],
  },
];

// ------------------------------------------------------------ ชิ้นส่วนภาพประกอบ

function ControlRow({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-navy-800/70 px-3 py-2.5">
      <span aria-hidden className="text-lg leading-6">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-400">{desc}</p>
      </div>
    </div>
  );
}

function Beat({ top, bottom, accent }: { top: string; bottom: string; accent?: boolean }) {
  return (
    <span
      className={`rounded-lg border px-3 py-2 ${
        accent ? 'border-brand-500/60 bg-brand-500/10' : 'border-line bg-navy-800/70'
      }`}
    >
      <span className="block text-slate-200">{top}</span>
      <span className={`tabular block text-[11px] ${accent ? 'text-brand-300' : 'text-slate-500'}`}>
        {bottom}
      </span>
    </span>
  );
}

function Arrow() {
  return (
    <span aria-hidden className="text-slate-600">
      →
    </span>
  );
}
