import type { RoomState, SolveStatus } from './types';

/** ข้อความ "สถานะการเล่น" ตามภาพ `design/Match - Join.png` / `Match - Playing.png` */
export const ROOM_STATE_LABEL: Record<RoomState, string> = {
  WAITING: 'รอผู้เล่น',
  MATCHED: 'จับคู่ได้แล้ว',
  LOADING: 'กำลังโหลดคิวบ์',
  COUNTDOWN: 'กำลังจะเริ่ม',
  INSPECTION: 'ช่วงตรวจสอบ',
  SOLVING: 'อยู่ในระหว่างการเล่น',
  FINAL_COUNTDOWN: 'นับถอยหลังรอบสุดท้าย',
  FINISHED: 'จบการแข่งขัน',
  ABORTED: 'ห้องถูกยุบ',
};

/** ป้ายสถานะใต้คิวบ์ของผู้เล่นแต่ละคน */
export const SOLVE_STATUS_LABEL: Record<SolveStatus, string> = {
  solving: 'กำลังแก้',
  solved: 'แก้เสร็จแล้ว',
  dnf: 'DNF',
  surrendered: 'ยอมแพ้',
};
