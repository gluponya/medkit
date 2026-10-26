import { asc } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { uuidv7 } from 'uuidv7';

import { searchText } from '@/domain/register';

import { db } from './db/client';
import { customCategories } from './db/schema';

export type CustomCategory = typeof customCategories.$inferSelect;

/** The person's own categories, oldest first: they follow the built-in ones. */
export function useCustomCategories(): CustomCategory[] {
  const { data } = useLiveQuery(db.select().from(customCategories).orderBy(asc(customCategories.createdAt)));
  return data;
}

/**
 * «Додати категорію»: a new own category, its id. One with the same name is
 * picked instead of a second one.
 */
export async function addCustomCategory(name: string, icon: string): Promise<string> {
  const key = searchText(name.trim());
  const all = await db.select().from(customCategories);
  const same = all.find((c) => searchText(c.name.trim()) === key);
  if (same) return same.id;
  const id = uuidv7();
  await db.insert(customCategories).values({ id, name: name.trim(), icon });
  return id;
}
