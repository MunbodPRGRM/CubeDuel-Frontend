/**
 * ข้อความระดับฟอร์ม (ไม่ผูกกับฟิลด์ไหน)
 *   - `error` (ค่าเริ่มต้น) เช่น รหัสผ่านผิด บัญชีถูกระงับ เรียกถี่เกินไป
 *   - `success` เช่น ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว ตั้งรหัสผ่านใหม่สำเร็จ
 */
export function FormAlert({
  message,
  tone = 'error',
}: {
  message: string;
  tone?: 'error' | 'success';
}) {
  const colors =
    tone === 'error' ? 'border-loss/40 bg-loss/10 text-loss' : 'border-win/40 bg-win/10 text-win';
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-3.5 py-2.5 text-sm ${colors}`}
    >
      {message}
    </p>
  );
}
