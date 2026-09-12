import type { ReactNode } from 'react';
import { COACH_STEPS, type PracticeCoach } from './usePracticeCoach';

/**
 * การ์ดโค้ชของห้องฝึกซ้อม (ADR-065) — **ลอยอยู่ข้างคิวบ์ ไม่คลุมจอ**
 * ต่างจากคู่มือการใช้เว็บที่เป็น modal (ADR-053) เพราะขั้นตอนที่สอนคือ "ลากคิวบ์"
 * ถ้าเอากล่องไปทับคิวบ์ก็ทำตามไม่ได้
 *
 * กล่องนี้วางแบบ `absolute` ทับกล่องคิวบ์ จึงต้องไม่กินพื้นที่ลากของคิวบ์เกินตัวมันเอง
 */
export function PracticeCoachCard({ coach }: { coach: PracticeCoach }) {
  if (!coach.active) return null;

  const stepNo = coach.step ? COACH_STEPS.indexOf(coach.step) + 1 : COACH_STEPS.length;

  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-10 w-[17rem] rounded-2xl border border-brand-500/40 bg-navy-950/90 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] tracking-wide text-brand-400">
          {coach.finished
            ? 'ลองเล่นครบแล้ว'
            : `สอนใช้งาน · ขั้นที่ ${stepNo} จาก ${COACH_STEPS.length}`}
        </p>
        <button
          type="button"
          onClick={coach.dismiss}
          aria-label="ปิดโหมดสอน"
          className="-mr-1 -mt-1 shrink-0 rounded-lg px-2 py-0.5 text-slate-500 transition hover:bg-navy-800 hover:text-slate-200"
        >
          ✕
        </button>
      </div>

      {coach.finished ? (
        <>
          <p className="mt-1 font-semibold text-slate-100">ครบทั้ง 4 ท่าแล้ว 🎉</p>
          <p className="mt-1.5 text-xs leading-5 text-slate-400">
            จากนี้เล่นได้ตามใจเลย · อยากดูซ้ำกดปุ่ม “Tutorial” ด้านบนได้ทุกเมื่อ
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 font-semibold text-slate-100">{coach.step?.title}</p>
          <p className="mt-1.5 text-xs leading-5 text-slate-400">
            <CoachText text={coach.step?.body ?? ''} />
          </p>
        </>
      )}

      <ul className="mt-3 space-y-1.5 border-t border-line-soft pt-3">
        {COACH_STEPS.map((entry) => {
          const complete = coach.done.has(entry.signal);
          const current = coach.step?.signal === entry.signal;
          return (
            <li
              key={entry.signal}
              className={`flex items-center gap-2 text-xs ${
                complete ? 'text-win' : current ? 'text-slate-100' : 'text-slate-600'
              }`}
            >
              <span
                aria-hidden
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px] ${
                  complete
                    ? 'border-win bg-win/15'
                    : current
                      ? 'border-brand-400 text-brand-400'
                      : 'border-line'
                }`}
              >
                {complete ? '✓' : ''}
              </span>
              {entry.label}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={coach.dismiss}
        className="mt-3 w-full rounded-xl border border-line bg-navy-800 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-navy-700 hover:text-white"
      >
        {coach.finished ? 'เริ่มเล่นเลย' : 'ข้ามการสอน'}
      </button>
    </div>
  );
}

/** ตัวหนาแบบ `**…**` ในข้อความของแต่ละขั้น — เนื้อหาเป็นค่าคงที่ในโค้ด ไม่ใช่ข้อมูลจากผู้ใช้ */
function CoachText({ text }: { text: string }): ReactNode {
  return text.split('**').map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-slate-200">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}
