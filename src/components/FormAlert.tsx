/** ข้อความผิดพลาดระดับฟอร์ม (ไม่ผูกกับฟิลด์ไหน) เช่น รหัสผ่านผิด บัญชีถูกระงับ เรียกถี่เกินไป */
export function FormAlert({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-loss/40 bg-loss/10 px-3.5 py-2.5 text-sm text-loss"
    >
      {message}
    </p>
  );
}
