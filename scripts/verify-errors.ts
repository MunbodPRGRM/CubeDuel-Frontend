/**
 * ตรวจว่า **รหัส error ทุกตัวในเอกสารมีข้อความไทยที่ผู้ใช้อ่านรู้เรื่อง** และทั้งสามที่พูดตรงกัน
 * (เฟส 10 ก้อนที่ 3 — ADR-054)
 *
 * ไล่เทียบสามทาง:
 *   เอกสาร `docs/api-contract.md` + `docs/socket-events.md`
 *     ↔ ฝั่ง frontend  (`src/lib/errors.ts` · `src/types/auth.ts` · `src/socket/types.ts`)
 *     ↔ ฝั่ง backend   (`backend/src/lib/errors.ts` · `backend/src/sockets/errors.ts`)
 *
 * ทำไมต้องมีสคริปต์: ไม่มี `shared/` แล้ว (ADR-021) สองฝั่งผูกกันด้วยเอกสารอย่างเดียว
 * เพิ่มรหัสใหม่แล้วลืมแก้อีกฝั่ง **ไม่มีอะไรเตือนเลย** จนกว่าผู้ใช้จะเจอข้อความว่างบนจอ
 *
 * `docs/` กับ `backend/` อยู่คนละ repo กับ frontend — ถ้าเช็กเอาต์มาแค่ repo นี้
 * สคริปต์จะ **ข้ามส่วนที่หาไฟล์ไม่เจอ** แล้วบอกว่าข้ามอะไรไป ไม่ใช่ฟ้องว่าไม่ผ่าน
 *
 * รัน: `npm run verify:errors`
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ERROR_MESSAGES } from '../src/lib/errors.ts';

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, '..');
const workspaceRoot = resolve(frontendRoot, '..');

let failures = 0;
let skipped = 0;

function check(label: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

function skip(label: string, why: string): void {
  skipped++;
  console.log(`  – ${label} — ข้าม (${why})`);
}

/** อ่านไฟล์ที่อาจไม่มีในเครื่องนี้ (คนละ repo) */
function readOptional(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

/**
 * รหัสทั้งหมดที่โผล่ในข้อความ เรียงตามตัวอักษรและไม่ซ้ำ
 *
 * lookbehind กัน `ALLOW_TEST_COMPETITIVE_ROOM` ถูกอ่านเป็นรหัส `E_ROOM` — ชื่อ env
 * กับชื่อ constant ที่ลงท้ายด้วย `E_` ตามด้วยตัวพิมพ์ใหญ่มีอยู่จริงในเอกสาร
 */
function codesIn(text: string): string[] {
  return [...new Set(text.match(/(?<![A-Za-z0-9_])E_[A-Z_]+/g) ?? [])].sort();
}

/** สมาชิกของ union type ตัวหนึ่ง เช่น `export type ErrorCode = | 'E_A' | 'E_B';` */
function unionMembers(source: string, typeName: string): string[] | null {
  const match = new RegExp(`type ${typeName}\\s*=([^;]*);`).exec(source);
  return match ? codesIn(match[1]!) : null;
}

/** ข้อความตั้งต้นของแต่ละรหัสในไฟล์ factory ของ backend (`xxx: (message = '…') => new …('E_X', …)`) */
function defaultMessages(source: string): Map<string, string> {
  const found = new Map<string, string>();
  const pattern = /\(message = '([^']*)'[^)]*\)\s*=>\s*\n?\s*new \w*Error\('(E_[A-Z_]+)'/g;
  for (const m of source.matchAll(pattern)) found.set(m[2]!, m[1]!);
  return found;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function diff(a: readonly string[], b: readonly string[]): string {
  const only = (x: readonly string[], y: readonly string[]) => x.filter((v) => !y.includes(v));
  const parts: string[] = [];
  if (only(a, b).length) parts.push(`มีเฉพาะฝั่งซ้าย: ${only(a, b).join(', ')}`);
  if (only(b, a).length) parts.push(`มีเฉพาะฝั่งขวา: ${only(b, a).join(', ')}`);
  return parts.join(' · ');
}

// ---------------------------------------------------------------- แหล่งข้อมูล

const catalogCodes = Object.keys(ERROR_MESSAGES).sort();
const frontendSource = readFileSync(resolve(frontendRoot, 'src/lib/errors.ts'), 'utf8');
const clientOnly = unionMembers(frontendSource, 'ClientErrorCode') ?? [];

const apiDoc = readOptional(resolve(workspaceRoot, 'docs/api-contract.md'));
const socketDoc = readOptional(resolve(workspaceRoot, 'docs/socket-events.md'));
const backendRest = readOptional(resolve(workspaceRoot, 'backend/src/lib/errors.ts'));
const backendSocket = readOptional(resolve(workspaceRoot, 'backend/src/sockets/errors.ts'));

const restCodes = unionMembers(
  readFileSync(resolve(frontendRoot, 'src/types/auth.ts'), 'utf8'),
  'ApiErrorCode',
)!;
const socketCodes = unionMembers(
  readFileSync(resolve(frontendRoot, 'src/socket/types.ts'), 'utf8'),
  'SocketErrorCode',
)!;

console.log('ตรวจรหัส error ทั้งระบบ (ADR-054)\n');

// ---------------------------------------------------------------- 1) เอกสารเป็นตัวตั้ง

console.log('1) รายชื่อรหัสในเอกสารตรงกับชนิดข้อมูลฝั่ง frontend');
{
  if (apiDoc) {
    const documented = codesIn(apiDoc);
    check(
      'docs/api-contract.md ↔ ApiErrorCode',
      sameSet(documented, restCodes),
      diff(documented, restCodes) || `${documented.length} รหัส`,
    );
  } else skip('docs/api-contract.md ↔ ApiErrorCode', 'ไม่มีโฟลเดอร์ docs/ ข้าง repo นี้');

  if (socketDoc) {
    const documented = codesIn(socketDoc);
    check(
      'docs/socket-events.md ↔ SocketErrorCode',
      sameSet(documented, socketCodes),
      diff(documented, socketCodes) || `${documented.length} รหัส`,
    );
  } else skip('docs/socket-events.md ↔ SocketErrorCode', 'ไม่มีโฟลเดอร์ docs/ ข้าง repo นี้');
}

// ---------------------------------------------------------------- 2) ครบและอ่านรู้เรื่อง

console.log('\n2) ทุกรหัสมีข้อความไทยที่ผู้ใช้อ่านรู้เรื่อง');
{
  const expected = [...new Set([...restCodes, ...socketCodes, ...clientOnly])].sort();
  check(
    'คลังข้อความครอบคลุมทุกรหัส ไม่มีรหัสส่วนเกิน',
    sameSet(catalogCodes, expected),
    diff(catalogCodes, expected) || `${catalogCodes.length} รหัส`,
  );

  const thai = /[฀-๿]/;
  let bad = '';
  for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
    // กันข้อความว่าง · กัน TODO ที่ลืมไว้ · กันการเผลอเอาชื่อรหัสมาโชว์ให้ผู้ใช้อ่านเอง
    if (message.trim().length < 8 || !thai.test(message) || /E_[A-Z_]+|TODO/.test(message)) {
      bad = `${code} = "${message}"`;
      break;
    }
  }
  check('ทุกข้อความเป็นภาษาไทย ยาวพอ และไม่มีชื่อรหัสโผล่ให้ผู้ใช้เห็น', bad === '', bad);

  const byMessage = new Map<string, string[]>();
  for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
    byMessage.set(message, [...(byMessage.get(message) ?? []), code]);
  }
  const clashes = [...byMessage.values()].filter((codes) => codes.length > 1);
  check(
    'ไม่มีสองรหัสที่ใช้ข้อความเดียวกัน (ผู้ใช้แยกไม่ออกว่าเกิดอะไรขึ้น)',
    clashes.length === 0,
    clashes.map((codes) => codes.join(' = ')).join(' · '),
  );

  check(
    'รหัสฝั่ง client ไม่ไปโผล่ในเอกสารของ server',
    apiDoc === null ||
      socketDoc === null ||
      clientOnly.every((code) => !apiDoc.includes(code) && !socketDoc.includes(code)),
    clientOnly.join(', '),
  );
}

// ---------------------------------------------------------------- 3) สองฝั่งพูดตรงกัน

console.log('\n3) backend ประกาศรหัสชุดเดียวกับ frontend');
{
  if (backendRest) {
    const codes = unionMembers(backendRest, 'ErrorCode') ?? [];
    check(
      'backend lib/errors.ts ↔ ApiErrorCode',
      sameSet(codes, restCodes),
      diff(codes, restCodes),
    );
  } else skip('backend lib/errors.ts ↔ ApiErrorCode', 'ไม่มีโฟลเดอร์ backend/ ข้าง repo นี้');

  if (backendSocket) {
    const codes = unionMembers(backendSocket, 'SocketErrorCode') ?? [];
    check(
      'backend sockets/errors.ts ↔ SocketErrorCode',
      sameSet(codes, socketCodes),
      diff(codes, socketCodes),
    );
  } else
    skip('backend sockets/errors.ts ↔ SocketErrorCode', 'ไม่มีโฟลเดอร์ backend/ ข้าง repo นี้');
}

// ---------------------------------------------------------------- 4) สำนวนเดียวกัน

console.log('\n4) รหัสที่มีทั้งสองช่องทางพูดเหมือนกันเป๊ะ (ADR-054 ข้อ 2)');
{
  const shared = restCodes.filter((code) => socketCodes.includes(code));
  console.log(`  รหัสที่ใช้ร่วมกัน ${shared.length} ตัว: ${shared.join(', ')}`);

  if (backendRest && backendSocket) {
    const rest = defaultMessages(backendRest);
    const sock = defaultMessages(backendSocket);
    const catalog = ERROR_MESSAGES as Record<string, string>;
    let bad = '';

    for (const code of shared) {
      const a = rest.get(code);
      const b = sock.get(code);
      if (a === undefined || b === undefined) {
        bad = `${code} หาข้อความตั้งต้นไม่เจอ (REST: ${a ?? '—'} · socket: ${b ?? '—'})`;
        break;
      }
      if (a !== b) {
        bad = `${code} REST พูดว่า "${a}" แต่ socket พูดว่า "${b}"`;
        break;
      }
      if (a !== catalog[code]) {
        bad = `${code} backend พูดว่า "${a}" แต่คลังฝั่ง frontend พูดว่า "${catalog[code]}"`;
        break;
      }
    }
    check('ข้อความตั้งต้นของ REST · socket · คลังฝั่ง frontend ตรงกันทุกตัว', bad === '', bad);

    // รหัสที่ไม่ได้ใช้ร่วมกันก็ยังต้องตรงกับคลัง ถ้าอ่านข้อความตั้งต้นออกมาได้
    const all = new Map([...rest, ...sock]);
    const mismatched = [...all.entries()].filter(
      ([code, message]) => code in catalog && message !== catalog[code],
    );
    check(
      'รหัสที่เหลือของ backend ก็ตรงกับคลังฝั่ง frontend',
      mismatched.length === 0,
      mismatched.map(([code]) => code).join(', '),
    );
  } else skip('เทียบข้อความตั้งต้นของ backend', 'ไม่มีโฟลเดอร์ backend/ ข้าง repo นี้');
}

console.log(
  failures === 0
    ? `\nผ่านทุกข้อ ✅${skipped ? ` (ข้าม ${skipped} ข้อเพราะไม่ได้เช็กเอาต์ repo อื่นมาด้วย)` : ''}`
    : `\nไม่ผ่าน ${failures} ข้อ ❌`,
);
process.exit(failures === 0 ? 0 : 1);
