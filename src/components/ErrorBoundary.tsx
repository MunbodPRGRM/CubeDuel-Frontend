import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorAction, ErrorScreen } from './ErrorScreen';
import { ERROR_MESSAGES } from '@/lib/errors';

/**
 * ตาข่ายรับ error ที่หลุดออกมากลางการ **render**
 *
 * ทำไมต้องมี: React ถอด component tree ทั้งก้อนทิ้งเมื่อ render โยน error แล้ว **เหลือจอขาวเปล่า**
 * จนกว่าผู้ใช้จะรีเฟรชเอง ซึ่งไม่มีอะไรบนจอบอกว่าต้องรีเฟรช · ของจริงในโปรเจกต์นี้เคยเจอแล้ว
 * ตอน scramble ของประเภทหนึ่งไปโดนโมเดลของอีกประเภท (ดูหมายเหตุใน `PracticePage.tsx`)
 *
 * **ขอบเขตที่รับได้:** เฉพาะ error ตอน render / lifecycle ของลูก ๆ เท่านั้น
 * — error ใน event handler, `setTimeout` หรือ promise ที่ไม่ได้ `catch` **ไม่เข้าที่นี่**
 * (ข้อจำกัดของ React เอง) ของพวกนั้นต้องดักที่ต้นทางเหมือนเดิม
 *
 * **ทางออกมีแต่โหลดหน้าใหม่** ไม่มีปุ่ม "ลองอีกครั้ง" ที่แค่ล้าง state ของ boundary ทิ้ง
 * — พอ render พังกลางทาง state ที่ค้างอยู่ใน tree เชื่อไม่ได้แล้ว กดแล้วพังซ้ำที่เดิมเป็นส่วนใหญ่
 *
 * ⚠️ ห้ามใช้ hook ในไฟล์นี้ — `componentDidCatch` มีแต่ใน class component เท่านั้น
 */
interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // ยังไม่มีบริการเก็บ log ฝั่งนอก — อย่างน้อยต้องเห็นใน console ของเครื่องที่เจอปัญหา
    console.error('[render]', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <ErrorScreen
        title="หน้านี้ทำงานผิดพลาด"
        message={`${ERROR_MESSAGES.E_CLIENT} ถ้ายังไม่หาย ลองกลับไปหน้าแรกแล้วเข้ามาใหม่อีกครั้ง`}
        detail={import.meta.env.DEV ? error.message : null}
        actions={
          <>
            <ErrorAction onClick={() => window.location.reload()}>โหลดหน้านี้ใหม่</ErrorAction>
            <ErrorAction tone="ghost" onClick={() => window.location.assign('/')}>
              กลับหน้าแรก
            </ErrorAction>
          </>
        }
      />
    );
  }
}
