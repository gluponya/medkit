import { and, asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useState } from 'react';

import type { CabinetIcon } from '@/domain/places';
import type { MemberRole } from '@/domain/sharing';

import { db } from './db/client';
import { cabinets, members } from './db/schema';
import { usePrefs } from './prefs';
import { hasBackend, signedIn, supabase } from './remote/client';
import { syncNow } from './sync';

/**
 * Inviting, joining and the people of a shared cabinet (docs/model.md, "Person
 * and Membership"). These wait for the server and say so when it cannot be
 * reached; everything else in a shared cabinet works offline through the
 * outbox (src/data/sync).
 */

/** The server could not be reached; the screen says to try with a connection. */
export class NoConnectionError extends Error {}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!hasBackend) throw new NoConnectionError('no server in this build');
  try {
    await signedIn();
  } catch (e) {
    throw new NoConnectionError(String(e));
  }
  const { data, error } = await supabase.rpc(fn, args);
  // An error with no code never reached the database.
  if (error) throw error.code ? error : new NoConnectionError(error.message);
  return data as T;
}

const sync = () =>
  syncNow().catch((e: unknown) => {
    throw new NoConnectionError(String(e));
  });

/**
 * What others call this person. It goes to the server only once a cabinet is
 * shared; inviting and joining send it as well, so a name changed offline
 * catches up there.
 */
export async function setMyName(name: string): Promise<void> {
  usePrefs.getState().set({ name: name.trim() });
  const shared = await db.select({ id: cabinets.id }).from(cabinets).where(eq(cabinets.synced, true)).limit(1);
  if (shared.length > 0) await call('set_name', { name: name.trim() });
}

export interface Invite {
  /** Six characters, as the server keeps them: «K7Q4MP». */
  code: string;
  expiresAt: Date;
}

/**
 * «Запросити»: the cabinet's code while it lasts, or a new one. The first time
 * the cabinet goes up whole, with its owner as the first member.
 */
export async function invite(cabinetId: string): Promise<Invite> {
  await db
    .update(cabinets)
    .set({ synced: true, role: 'owner' })
    .where(and(eq(cabinets.id, cabinetId), eq(cabinets.synced, false)));
  const name = usePrefs.getState().name;
  if (name) await call('set_name', { name });
  await sync();
  const [row] = await call<{ code: string; expires_at: string }[]>('create_invite', { cabinet: cabinetId });
  return { code: row.code, expiresAt: new Date(row.expires_at) };
}

export interface InvitePeek {
  cabinetId: string;
  name: string;
  icon: CabinetIcon;
  /** Empty when the inviter has no name. */
  inviter: string;
  medicines: number;
  people: number;
  expired: boolean;
  /** This person is in the cabinet already. */
  joined: boolean;
}

/** What the Join screen shows; null for a code that leads nowhere. */
export async function peekInvite(code: string): Promise<InvitePeek | null> {
  const [row] = await call<
    {
      cabinet_id: string;
      name: string;
      icon: CabinetIcon;
      inviter: string;
      medicines: number;
      people: number;
      expired: boolean;
      joined: boolean;
    }[]
  >('peek_invite', { code });
  if (!row) return null;
  return { ...row, cabinetId: row.cabinet_id };
}

/** «Приєднатися»: the cabinet comes to the phone and is the current one. */
export async function joinByCode(code: string, name: string): Promise<string> {
  usePrefs.getState().set({ name: name.trim() });
  const cabinetId = await call<string>('join_cabinet', { code, name: name.trim() });
  await sync();
  return cabinetId;
}

/** The owner gives or takes admin. */
export async function setMemberRole(cabinetId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
  await call('set_member_role', { cabinet: cabinetId, person: userId, role });
  await sync();
}

/** «Прибрати з аптечки»: the owner takes someone out. */
export async function removeMember(cabinetId: string, userId: string): Promise<void> {
  await call('remove_member', { cabinet: cabinetId, person: userId });
  await sync();
}

export type Member = typeof members.$inferSelect & { me: boolean };

/** The people of a shared cabinet, the owner first, as last synced. */
export function useMembers(cabinetId: string): Member[] {
  const { data } = useLiveQuery(
    db.select().from(members).where(eq(members.cabinetId, cabinetId)).orderBy(asc(members.joinedAt)),
    [cabinetId],
  );
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data: auth }) => setMe(auth.session?.user.id ?? null));
  }, []);
  return [...data]
    .map((m) => ({ ...m, me: m.userId === me }))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
}

const ROLE_ORDER: Record<MemberRole, number> = { owner: 0, admin: 1, member: 2 };
