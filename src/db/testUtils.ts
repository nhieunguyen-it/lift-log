import { db } from './db';
import { ensureSeed } from './seed';

export async function resetDb(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()));
  await ensureSeed();
}
