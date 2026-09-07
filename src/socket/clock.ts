/**
 * นาฬิกาที่เทียบกับ server แล้ว — หัวใจของการนับถอยหลังทุกช่วงในเฟส 4
 *
 * ทุก event ที่มีเวลาส่งมาเป็น **`endsAtTs` ของ server** ไม่ใช่ "เหลืออีกกี่วินาที"
 * (`socket-events.md` ข้อ 6) ถ้า client เอา `Date.now()` ของเครื่องตัวเองไปลบตรง ๆ
 * เครื่องที่ตั้งเวลาเพี้ยนจะนับถอยหลังผิดทันที จึงต้องหา offset ระหว่างสองนาฬิกาก่อน
 *
 * วิธีหา (แบบเดียวกับ NTP ย่อส่วน): จับเวลาไป-กลับของ `net:ping` แล้วสมมติว่า
 * ขาไปกับขากลับใช้เวลาเท่ากัน → เวลาของ server ตอนที่เราได้ ack ≈ `serverTs + rtt/2`
 */

/** เก็บตัวอย่างล่าสุดไว้เท่านี้แล้วเลือกตัวที่ RTT ต่ำสุด (ตัวที่เพี้ยนน้อยที่สุด) */
const SAMPLE_WINDOW = 5;

export interface ClockSample {
  offsetMs: number;
  rttMs: number;
}

export class ServerClock {
  #samples: ClockSample[] = [];
  #best: ClockSample | null = null;

  /**
   * @param clientTs   เวลาของเราตอนส่ง ping
   * @param serverTs   เวลาของ server ที่แนบกลับมาใน ack
   * @param receivedTs เวลาของเราตอนได้ ack กลับมา
   */
  addSample(clientTs: number, serverTs: number, receivedTs: number): ClockSample {
    const rttMs = Math.max(receivedTs - clientTs, 0);
    const sample: ClockSample = { rttMs, offsetMs: serverTs + rttMs / 2 - receivedTs };

    this.#samples.push(sample);
    if (this.#samples.length > SAMPLE_WINDOW) this.#samples.shift();
    // RTT ต่ำ = ขาไปกับขากลับใกล้เคียงกันที่สุด = ค่า offset ที่น่าเชื่อที่สุดในชุด
    this.#best = this.#samples.reduce((a, b) => (b.rttMs < a.rttMs ? b : a));

    return sample;
  }

  /** ยังไม่เคย ping สำเร็จสักครั้ง — ระหว่างนี้ `now()` จะเท่ากับนาฬิกาเครื่องตัวเอง */
  get synced(): boolean {
    return this.#best !== null;
  }

  get offsetMs(): number {
    return this.#best?.offsetMs ?? 0;
  }

  /** RTT ของตัวอย่างล่าสุด — ค่านี้คือค่าที่รายงานกลับไปให้ server ใน ping ครั้งถัดไป */
  get lastRttMs(): number | null {
    return this.#samples.at(-1)?.rttMs ?? null;
  }

  /** เวลาปัจจุบันโดยประมาณ **ของ server** */
  now(): number {
    return Date.now() + this.offsetMs;
  }

  /** เหลืออีกกี่ ms ถึงเวลาของ server ที่ระบุ (ไม่ต่ำกว่า 0) */
  remainingMs(serverTs: number): number {
    return Math.max(serverTs - this.now(), 0);
  }

  /** ต่อใหม่แล้วเส้นทางเน็ตอาจเปลี่ยน — ทิ้งตัวอย่างเก่าทั้งหมด */
  reset(): void {
    this.#samples = [];
    this.#best = null;
  }
}
