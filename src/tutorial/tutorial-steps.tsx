/**
 * เนื้อหาของโหมดฝึกสอนการใช้งาน
 *
 * 📕 นี่คือ **onboarding การใช้งานเว็บ/แอป ไม่ใช่การสอนวิธีแก้รูบิค** (CLAUDE.md ข้อ 5.2)
 * ทุกอย่างที่พูดถึงในนี้ต้องเป็นสิ่งที่ระบบทำได้จริงตอนนี้ — ห้ามโฆษณาของที่ยังไม่มี
 * ตัวเลขเวลาทั้งหมดอ้างจาก `docs/game-rules.md` (ข้อ 1–4) ถ้ากติกาเปลี่ยน ต้องมาแก้ไฟล์นี้ด้วย
 */
import type { ReactNode } from 'react';
import { CubeLogo } from '@/components/CubeLogo';
import { CUBE_TYPES } from '@/types/cube';
import { CUBE_TYPE_LABEL } from '@/types/leaderboard';

export interface TutorialStep {
  /** ใช้เป็น React key และเป็นชื่อในการอ้างถึงเวลาคุยกัน */
  id: string;
  title: string;
  /** ย่อหน้าสั้น ๆ ใต้หัวข้อ */
  lead: string;
  /** ภาพประกอบ — วาดด้วย HTML/SVG ล้วน ไม่พึ่งไฟล์ภาพ (โหลดไว ไม่ต้องดูแล asset) */
  visual: ReactNode;
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
      'ข้ามได้ทุกเมื่อ แล้วกลับมาเปิดใหม่ได้จากปุ่ม ? บนแถบด้านบน',
      'ทุกอย่างในคู่มือนี้กดลองเองได้จากหน้าแรก',
    ],
  },
  {
    id: 'cube-type',
    title: 'เลือกประเภทรูบิคก่อนเล่นเสมอ',
    lead: 'มีให้เลือก 4 ประเภท และคะแนนแยกกันคนละชุด — เก่ง 3x3x3 ไม่ได้แปลว่าอันดับ Pyraminx สูงตาม',
    visual: (
      <div className="flex flex-wrap justify-center gap-2 py-4">
        {CUBE_TYPES.map((type, i) => (
          <span
            key={type}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              i === 1
                ? 'border-brand-500 bg-brand-500/15 font-medium text-brand-300'
                : 'border-line bg-navy-800 text-slate-400'
            }`}
          >
            {CUBE_TYPE_LABEL[type]}
          </span>
        ))}
      </div>
    ),
    points: [
      'ช่องเลือกอยู่บนการ์ดใหญ่ของหน้าแรก — คุมทั้งการจับคู่และตัวเลขสถิติที่โชว์อยู่',
      'สถิติ กระดานอันดับ และคะแนน ELO ทุกที่ในเว็บเป็นของประเภทที่เลือกไว้เท่านั้น',
      'เปลี่ยนประเภทระหว่างรอคิวไม่ได้ ต้องกดยกเลิกคิวก่อน',
    ],
  },
  {
    id: 'modes',
    title: 'ห้องมี 4 แบบ เลือกตามที่อยากได้',
    lead: 'ปุ่มทั้งหมดอยู่บนการ์ดใหญ่ของหน้าแรก',
    visual: (
      <div className="grid gap-2 py-2 sm:grid-cols-2">
        <ModeCard name="แข่งขัน" desc="จับคู่อัตโนมัติ 1v1 · มีผลต่อคะแนน ELO" highlight />
        <ModeCard name="ห้องหลายคน" desc="3–4 คน · จับคู่อัตโนมัติแล้วมีผลต่อคะแนน" />
        <ModeCard name="ฝึกซ้อม" desc="เล่นคนเดียว · ไม่บันทึกอะไรลงระบบ" />
        <ModeCard name="สร้างห้อง" desc="แชร์รหัสห้องให้เพื่อน · มีคนดูได้ · ไม่มีผลต่อคะแนน" />
      </div>
    ),
    points: [
      'อยากลองระบบโดยไม่เสียคะแนน เริ่มที่ “ฝึกซ้อม” — ไม่ถูกบันทึกลงประวัติเลย',
      'มีรหัสห้องจากเพื่อนแล้ว กด “ใส่เลขห้อง” ได้เลย',
    ],
  },
  {
    id: 'controls',
    title: 'บังคับคิวบ์ยังไง',
    lead: 'คิวบ์เป็นของ 3 มิติจริง ๆ ลากได้ทั้งตัวลูกและมุมกล้อง',
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
    ],
  },
  {
    id: 'timeline',
    title: 'ลำดับเวลาในห้องแข่ง',
    lead: 'ทุกคนในห้องเริ่มพร้อมกันเสมอ และเวลาที่ใช้ตัดสินเป็นของเซิร์ฟเวอร์',
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
      'ช่วงตรวจสอบ 15 วินาที หมุนดูได้แต่บิดไม่ได้ และกดข้ามไม่ได้ (ยกเว้นห้องฝึกซ้อม)',
      'พอมีคนแก้เสร็จคนแรก คนที่เหลือมีเวลาอีก 10 วินาที ไม่เสร็จถือเป็น DNF',
      'ออกจากห้องกลางคันหรือเน็ตหลุดยาว = แพ้ในรอบนั้น',
    ],
  },
  {
    id: 'score',
    title: 'คะแนน อันดับ และสถิติ',
    lead: 'ผลการแข่งในห้องที่มีผลคะแนนจะถูกบันทึกให้เองทุกนัด',
    visual: (
      <div className="grid gap-2 py-2 sm:grid-cols-3">
        <MiniStat label="ELO" value="1000" note="คะแนนเริ่มต้นทุกประเภท" />
        <MiniStat label="กระดานอันดับ" value="Top 100" note="มีแบบรายสัปดาห์ด้วย" />
        <MiniStat label="สถิติ" value="Ao5 / Ao12" note="ดูได้ในหน้าโปรไฟล์" />
      </div>
    ),
    points: [
      'ชนะได้คะแนน แพ้เสียคะแนน — ปรับเฉพาะประเภทที่เพิ่งแข่ง',
      'กระดานรายสัปดาห์เริ่มนับใหม่ทุกวันจันทร์',
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
      'แก้ชื่อเล่นและสกินสีคิวบ์ได้ที่หน้าตั้งค่า',
      'เจอคนเล่นไม่ตรงไปตรงมา กดรายงานได้จากหน้าผลการแข่งขัน',
      'อยากอ่านคู่มือนี้ใหม่ กดปุ่ม ? บนแถบด้านบนได้ตลอด',
    ],
  },
];

// ------------------------------------------------------------ ชิ้นส่วนภาพประกอบ

function ModeCard({ name, desc, highlight }: { name: string; desc: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        highlight ? 'border-brand-500/60 bg-brand-500/10' : 'border-line bg-navy-800/70'
      }`}
    >
      <p className={`text-sm font-semibold ${highlight ? 'text-brand-300' : 'text-slate-200'}`}>
        {name}
      </p>
      <p className="mt-0.5 text-xs leading-5 text-slate-400">{desc}</p>
    </div>
  );
}

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

function MiniStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-line bg-navy-800/70 px-3 py-2.5 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="tabular mt-0.5 text-lg font-semibold text-slate-100">{value}</p>
      <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{note}</p>
    </div>
  );
}
