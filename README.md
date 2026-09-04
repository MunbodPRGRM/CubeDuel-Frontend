# CubeDuel — Frontend

หน้าเว็บและแอปมือถือของ **CubeDuel** เกมแข่งขันรูบิค 3 มิติออนไลน์ (โปรเจกต์จบ ป.ตรี วิทยาการคอมพิวเตอร์ ม.มหาสารคาม)

รับผิดชอบ: คิวบ์ 3 มิติที่หมุนได้จริง · ห้องแข่งขันแบบ real-time · หน้าสถิติ/กระดานอันดับ/โปรไฟล์/แอดมิน

**ใช้โค้ดชุดเดียวกันทั้งเว็บและมือถือ** — ห่อด้วย Capacitor เป็นแอป Android/iOS ไม่ได้แยกโปรเจกต์

| ส่วน | เทคโนโลยี |
|---|---|
| Framework | React 18 + TypeScript 5 |
| Build tool | Vite 6 |
| Styling | Tailwind CSS 4 (ผ่าน `@tailwindcss/vite`) |
| 3D | Three.js + **cubing.js** (จำลอง/คำนวณสถานะรูบิค) |
| Animation | GSAP |
| Routing | React Router 6 |
| Real-time | Socket.IO client (เฟส 4) |
| Mobile | Capacitor (เฟส 9) |

---

## ⚠️ สัญญาระหว่างสองฝั่งอยู่ในเอกสาร ไม่ใช่ในโค้ด

repo นี้ **โคลนมาเดี่ยว ๆ แล้วรันได้เลย** ไม่ต้องพึ่งโค้ดนอก repo (ADR-021)

แลกมาด้วยเงื่อนไข: **ไม่มี TypeScript คอยจับว่า payload ตรงกับฝั่ง backend ไหม** — จะแก้ payload ของ endpoint หรือ socket event ไหน **ต้องเปิด `docs/api-contract.md` / `docs/socket-events.md` แก้ก่อน แล้วไล่แก้ให้ครบทั้งสองฝั่งในคราวเดียว** ถ้าลืม จะไม่มีอะไรเตือนจนกว่าจะพังตอนรันจริง

`src/types/cube.ts` ต้องตรงกับ `backend/src/types/cube.ts` เป๊ะ (4 ประเภท ล็อกไว้ในเล่มแล้ว ไม่เพิ่มอีก)

เวลาพัฒนาให้โคลนคู่กับอีกฝั่งไว้ จะได้อ่านเอกสารชุดเดียวกัน:

```
CubeDuel/
├── frontend/    ← repo นี้
├── backend/     ← github.com/MunbodPRGRM/CubeDuel-Backend
└── docs/        ← สเปกทั้งหมด (แหล่งความจริง)
```

## สิ่งที่ต้องมี

- Node.js 22 ขึ้นไป
- backend รันอยู่ที่ `http://localhost:4000` (ถ้าจะเรียก API — หน้าที่ไม่เรียก API เปิดได้เลย)

## วิธีรัน dev

```bash
npm install
cp .env.example .env
npm run dev        # http://localhost:5173
```

## คำสั่งที่มี

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | Vite dev server + HMR |
| `npm run build` | ตรวจ type ด้วย `tsc -b` แล้ว build ลง `dist/` |
| `npm run preview` | เปิดดูผลลัพธ์ที่ build แล้ว |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## ตัวแปรสภาพแวดล้อม

Vite อ่านเฉพาะตัวที่ขึ้นต้นด้วย `VITE_` เท่านั้น

| ตัวแปร | ค่าเริ่มต้น | ใช้ทำอะไร |
|---|---|---|
| `VITE_API_URL` | `http://localhost:4000/api/v1` | ปลายทาง REST (`src/lib/api.ts`) |
| `VITE_SOCKET_URL` | `http://localhost:4000` | ปลายทาง Socket.IO (เฟส 4) |

## โครงสร้างโค้ด

```
src/
├── main.tsx           จุดเริ่ม — mount React
├── App.tsx            component ราก (ตอนนี้เป็นหน้าทดสอบ)
├── types/cube.ts      4 ประเภทรูบิค (ต้องตรงกับฝั่ง backend)
├── lib/api.ts         ตัวห่อ fetch — เติม base URL + header ให้อัตโนมัติ
├── styles/index.css   entry ของ Tailwind
└── vite-env.d.ts      type ของ import.meta.env
```

## ข้อควรจำ (บทเรียนจาก PoC เฟส 0 / 0.5)

- **ห้ามลบ `optimizeDeps: { exclude: ["cubing"] }` ใน `vite.config.ts`** — ไม่งั้น scramble worker ของ cubing.js จะ 404
- `2x2x2` / `3x3x3` / `pyraminx` ใช้ `<twisty-player>` ของ cubing.js ได้เลย
- **`pyramorphix` ใช้ `<twisty-player>` ไม่ได้** (โมเดลของ cubing.js มีแค่ 96 สถานะ ใช้แข่งไม่ได้) → ตรรกะยืม KPuzzle ของ 2x2x2 ส่วนการแสดงผล**เขียน renderer เองด้วย Three.js** (ADR-019)
  → ฝั่ง 3D จึงมี **2 เส้นทาง** ต้องมี interface กลางครอบไว้เสมอ
- `experimentalIsSolved` ใช้กับ pyraminx ไม่ได้ → ใช้ `isIdentical(defaultPattern())` แทน และห้ามรับ move ที่หมุนทั้งลูก (ADR-018)
- headless browser จับภาพ canvas WebGL ไม่ติด — ถ้าจะตรวจ render อัตโนมัติต้องใช้ `player.experimentalScreenshot()`

## สถานะ (2026-09-03) — เฟส 1

ใช้งานได้แล้ว: Vite + React + Tailwind ขึ้นครบ · alias `@/*` ชี้ไป `src/` · `npm run build` ผ่าน · ESLint/Prettier ตั้งแล้ว

ยังไม่ได้ทำ: routing · หน้าจอทุกหน้า · คิวบ์ 3 มิติ (เฟส 3) · Socket.IO client (เฟส 4) · Capacitor (เฟส 9)

## เอกสาร

สเปกจริงอยู่ใน `docs/` ที่ root ของโปรเจกต์ — `game-rules.md` (กติกา) · `socket-events.md` · `api-contract.md` · `decisions.md` (ADR) · `roadmap.md` (ทำถึงไหนแล้ว)
