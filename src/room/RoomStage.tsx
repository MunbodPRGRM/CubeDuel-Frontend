import type { ReactNode } from 'react';
import type { ResolvedRoomLayout } from '@/lib/play-prefs';

interface RoomStageProps {
  layout: ResolvedRoomLayout;
  /** แผงคิวบ์ของเรา (ผู้ชมได้แผงของ `players[0]`) — อยู่ซ้าย/บนเสมอทุกแบบ */
  self: ReactNode;
  /** แผงคิวบ์คู่แข่ง เรียงตามลำดับที่นั่ง (ห้องยังไม่เต็มมีช่องว่างปนมาด้วย) */
  rivals: ReactNode[];
  /** แผงคู่แข่งถูกย่อแล้วหรือยัง — ตัวเดียวกับที่ส่งให้ `PlayerCubePanel` */
  compactRivals: boolean;
  /** การ์ดหัวห้อง + แผงข้อมูลตรงกลาง */
  info: ReactNode;
}

/**
 * **ตัวจัดวางหน้าห้องแข่ง 4 แบบ** (ADR-063 ข้อ 3) — ไฟล์นี้มีแต่ CSS ไม่มีตรรกะของเกม
 *
 * กติกาสองข้อที่ทุกแบบต้องทำตาม (เจ้าของสั่ง 2026-09-12):
 *   1. **ช่องข้อมูลเป็นคอลัมน์เสมอ** — ซ้าย/กลาง/ขวาเท่านั้น ห้ามเป็นแถบบนหรือล่าง
 *   2. **เราอยู่ก่อนคู่แข่งเสมอ** (ซ้าย/บน) คิวบ์ของตัวเองจะได้ไม่ย้ายที่เวลาสลับแบบ
 *
 * จอแคบกว่า `lg` ทุกแบบซ้อนเป็นแนวตั้ง เรา → ข้อมูล → คู่แข่ง (ลำดับใน DOM เป็นแบบนั้นอยู่แล้ว)
 * ยกเว้น `focus` ที่คงคู่แข่งลอยมุมไว้ เพราะนั่นคือสาระของมัน (= PiP บนมือถือ, CLAUDE.md ข้อ 9)
 *
 * ⚠️ กล่องที่ครอบ `PlayerCubePanel` ต้องเป็น **grid item โดยตรง** หรือมีความสูงของตัวเอง
 * ไม่งั้น `lg:h-full` ของแผงจะตกกลับไปเป็น `auto` แล้วคิวบ์จะสูงเป็นศูนย์
 */
export function RoomStage({ layout, self, rivals, compactRivals, info }: RoomStageProps) {
  /**
   * คอลัมน์คู่แข่ง — ห้อง 1v1 คือกล่องเดิมที่แผงล็อกความสูงเอง
   * ห้อง 3–4 คนให้คอลัมน์ล็อกความสูงแทน แล้วหารให้แผงย่อยเท่า ๆ กัน (ADR-044 ข้อ 3)
   */
  const rivalColumn = (extra: string): ReactNode => (
    <div
      className={
        compactRivals ? `flex h-[30rem] flex-col gap-3 lg:h-auto lg:min-h-0 ${extra}` : extra
      }
    >
      {rivals}
    </div>
  );

  /** ช่องข้อมูล — จอเตี้ยกว่าเนื้อหาให้เลื่อนในคอลัมน์ตัวเอง ปุ่มยอมแพ้/ออกจากห้องต้องกดถึงเสมอ */
  const infoColumn = (extra: string): ReactNode => (
    <div className={`flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto ${extra}`}>{info}</div>
  );

  if (layout === 'classic') {
    return (
      // layout สามคอลัมน์ "แบบเดิม" ของก้อนที่ 1 — ADR-059 ข้อ 5 สั่งให้คงไว้ ห้ามแก้สัดส่วน
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_360px_1fr]">
        {self}
        {infoColumn('')}
        {rivalColumn('lg:min-h-0')}
      </div>
    );
  }

  if (layout === 'stacked') {
    return (
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
        {self}
        {infoColumn('lg:col-start-2 lg:row-span-2 lg:row-start-1')}
        {rivalColumn('lg:col-start-1 lg:row-start-2 lg:min-h-0')}
      </div>
    );
  }

  if (layout === 'focus') {
    return (
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="relative lg:min-h-0">
          {self}
          {/* แผงคู่แข่งลอยทับมุมขวาบนของกล่องคิวบ์เรา — กล่องนอกไม่รับนิ้ว ไม่งั้นจะไปบังการลากคิวบ์ */}
          <div className="pointer-events-none absolute right-3 top-3 z-10 flex w-32 flex-col gap-2 sm:w-40 lg:w-56">
            {rivals.map((rival, index) => (
              <div key={index} className="pointer-events-auto flex h-24 sm:h-28 lg:h-40">
                {rival}
              </div>
            ))}
          </div>
        </div>
        {infoColumn('')}
      </div>
    );
  }

  // `sides` (A) — คิวบ์สองลูกแบ่งพื้นที่เท่ากัน ข้อมูลเป็นคอลัมน์ขวา
  return (
    <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_22rem]">
      {self}
      {infoColumn('lg:col-start-3')}
      {rivalColumn('lg:col-start-2 lg:row-start-1 lg:min-h-0')}
    </div>
  );
}
