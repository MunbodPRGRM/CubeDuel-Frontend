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
├── main.tsx           จุดเริ่ม — mount React + BrowserRouter
├── App.tsx            เส้นทางทั้งหมด (routes) ห่อด้วย <AuthProvider>
├── auth/              สถานะ "ใครล็อกอินอยู่" ของทั้งแอป
│   ├── auth-context.ts   context + type
│   ├── AuthProvider.tsx  กู้เซสชันตอนเปิดแอป · login / register / logout
│   ├── useAuth.ts        hook สำหรับใช้ในหน้าจอ
│   └── RequireAuth.tsx   ห่อหน้าที่ต้องล็อกอินก่อน
├── pages/             HomePage · LoginPage · RegisterPage · NotFoundPage
├── components/        AppHeader · AuthLayout · CubeLogo · Avatar · TextField · SubmitButton
│                      FormAlert · PageSpinner · StatCard · LeaderboardCard · CubeTypePicker
├── hooks/useApiData   ดึงข้อมูลอ่านอย่างเดียวมาแสดง (ยังไม่มี cache — ดูคอมเมนต์ในไฟล์)
├── lib/format.ts      จัดรูปแบบเวลา/อัตราชนะ/คะแนนที่เปลี่ยน
├── types/cube.ts      4 ประเภทรูบิค (ต้องตรงกับฝั่ง backend)
├── types/auth.ts      payload ของ endpoint auth (ต้องตรงกับ api-contract.md)
├── lib/api.ts         ตัวห่อ fetch — แกะ envelope · แนบ token · ต่ออายุอัตโนมัติ
├── lib/validation.ts  กฎ validation ฝั่งหน้าจอ (สะท้อนกฎของ server)
├── styles/index.css   entry ของ Tailwind + **token สีทั้งเว็บ** (`@theme`)
└── vite-env.d.ts      type ของ import.meta.env
```

### หน้าตาเว็บ — ยึดภาพดีไซน์เป็นหลัก (ADR-024)

**แหล่งความจริงของ UI คือภาพในโฟลเดอร์ `ตัวอย่างเว็บไซต์/` ที่ root ของโปรเจกต์** (14 ภาพ) เหมือนที่ `docs/` เป็นแหล่งความจริงของตรรกะ

- **ธีมมืดอย่างเดียว** ไม่มี light mode
- สีทุกสีอยู่ใน `src/styles/index.css` ใต้ `@theme` → ใช้เป็นคลาสได้เลย (`bg-navy-850`, `text-brand-400`, `border-line`)
  **ห้ามใส่ค่าสีดิบ (`#0a1524`) ในคอมโพเนนต์** ไม่งั้นเวลาปรับโทนทั้งเว็บจะต้องไล่แก้ทีละไฟล์
- ฟอนต์: Inter (ละติน/ตัวเลข) + Noto Sans Thai (ไทย) โหลดจาก Google Fonts ใน `index.html`
- ตัวเลขที่ต้องเรียงตรงกัน (เวลา/คะแนน) ใส่คลาส `tabular` ด้วย
- โลโก้คิวบ์เป็น SVG ในโค้ด (`CubeLogo.tsx`) **ไม่ใช่** คิวบ์ 3 มิติของจริง (อันนั้นเป็นงานเฟส 3 คนละตัวกัน)
- **ห้ามใส่ตัวเลขปลอมเพื่อให้หน้าจอดูเหมือนภาพดีไซน์** — ข้อมูลที่ยังไม่มีให้แสดง `—` พร้อมบอกว่าจะมาในเฟสไหน

### เรื่อง token ที่ต้องเข้าใจก่อนแก้ `lib/api.ts`

- **access token อยู่ในตัวแปรในหน่วยความจำเท่านั้น** ห้ามเขียนลง `localStorage` (ADR-010) → รีเฟรชหน้าแล้วหายเป็นเรื่องปกติ
- ตอนเปิดแอปทุกครั้ง `AuthProvider` จะยิง `POST /auth/refresh` หนึ่งครั้งเพื่อกู้เซสชันจาก **httpOnly cookie** ที่ JavaScript อ่านไม่ได้
  → เห็น `401` ของ `/auth/refresh` ใน console ตอนยังไม่ได้ล็อกอิน **เป็นเรื่องปกติ ไม่ใช่บั๊ก**
- ทุก request ต้องมี `credentials: 'include'` ไม่งั้น browser ไม่ส่ง cookie ไปให้
- `apiFetch` เจอ 401 จะต่ออายุ token แล้วยิงซ้ำให้เอง **ยกเว้น** endpoint ที่ส่ง `retryOnExpired: false` (login/register — 401 ที่นั่นแปลว่ารหัสผ่านผิด)

## ข้อควรจำ (บทเรียนจาก PoC เฟส 0 / 0.5)

- **ห้ามลบ `optimizeDeps: { exclude: ["cubing"] }` ใน `vite.config.ts`** — ไม่งั้น scramble worker ของ cubing.js จะ 404
- `2x2x2` / `3x3x3` / `pyraminx` ใช้ `<twisty-player>` ของ cubing.js ได้เลย
- **`pyramorphix` ใช้ `<twisty-player>` ไม่ได้** (โมเดลของ cubing.js มีแค่ 96 สถานะ ใช้แข่งไม่ได้) → ตรรกะยืม KPuzzle ของ 2x2x2 ส่วนการแสดงผล**เขียน renderer เองด้วย Three.js** (ADR-019)
  → ฝั่ง 3D จึงมี **2 เส้นทาง** ต้องมี interface กลางครอบไว้เสมอ
- `experimentalIsSolved` ใช้กับ pyraminx ไม่ได้ → ใช้ `isIdentical(defaultPattern())` แทน และห้ามรับ move ที่หมุนทั้งลูก (ADR-018)
- headless browser จับภาพ canvas WebGL ไม่ติด — ถ้าจะตรวจ render อัตโนมัติต้องใช้ `player.experimentalScreenshot()`

## สถานะ (2026-09-04) — เฟส 2 + รื้อ UI ตามดีไซน์

ใช้งานได้แล้ว: routing · หน้าสมัครสมาชิก · หน้าเข้าสู่ระบบ · หน้าแรก · หน้า 404 — **ทำตามภาพดีไซน์แล้ว (ADR-024)**
กู้เซสชันเองหลังรีเฟรชหน้า · ต่ออายุ access token อัตโนมัติ · แสดง error รายฟิลด์ที่ server ส่งมา
หน้าแรกดึงข้อมูลจริง: ELO + อันดับของตัวเอง (`/users/:id/ratings`) และกระดานอันดับ 5 อันดับแรก (`/leaderboard`)

**ทดสอบด้วย browser จริงแล้ว:** สมัคร → รีเฟรชแล้วยังล็อกอินอยู่ (`localStorage` ว่าง · `document.cookie` ว่าง = httpOnly ทำงานจริง) → ออกจากระบบแล้วรีเฟรชไม่กลับมาเอง → รหัสผ่านผิดขึ้นข้อความถูกต้อง → สลับประเภทรูบิคแล้วกระดานอันดับเปลี่ยนตาม → จอ 390px ไม่มีสกอลล์แนวนอน

ยังไม่ได้ทำ: หน้าลืมรหัสผ่าน (รอ endpoint ฝั่ง backend) · ปุ่ม OAuth · หน้าอื่นในโฟลเดอร์ดีไซน์ (ห้องแข่ง/โปรไฟล์/กระดานอันดับเต็ม — ทำตามเฟสของมัน) · คิวบ์ 3 มิติ (เฟส 3) · Socket.IO client (เฟส 4) · Capacitor (เฟส 9)

## เอกสาร

สเปกจริงอยู่ใน `docs/` ที่ root ของโปรเจกต์ — `game-rules.md` (กติกา) · `socket-events.md` · `api-contract.md` · `decisions.md` (ADR) · `roadmap.md` (ทำถึงไหนแล้ว)
