import { CUBE_TYPES } from '@/types/cube';

export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">CubeDuel</h1>
      <p className="text-sm opacity-70">โครงโปรเจกต์เฟส 1 — ยังไม่มีหน้าจอจริง</p>
      <ul className="flex gap-3 text-sm">
        {CUBE_TYPES.map((t) => (
          <li key={t} className="rounded border px-2 py-1">
            {t}
          </li>
        ))}
      </ul>
    </main>
  );
}
