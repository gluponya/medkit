import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState } from 'react';

const NONE: never[] = [];

/**
 * A live query that follows every table it reads, not only the one it selects
 * from: drizzle's `useLiveQuery` runs again only when its FROM table changes,
 * so a joined medicine renamed or moved left Today and Home stale.
 *
 * The answer belongs to the deps it was asked with: while the query for new
 * deps runs, `data` is empty and `updatedAt` undefined, never the previous
 * medicine's or cabinet's rows.
 */
export function useLiveRows<T>(
  query: PromiseLike<T[]>,
  deps: readonly unknown[],
  tables: readonly string[],
): { data: T[]; updatedAt: Date | undefined } {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{ key: string; data: T[]; updatedAt: Date | undefined }>({
    key,
    data: NONE,
    updatedAt: undefined,
  });

  useEffect(() => {
    let live = true;
    // Two runs close together may answer out of order: only the last one counts.
    let run = 0;
    const load = () => {
      const mine = ++run;
      query.then(
        (data) => {
          if (live && mine === run) setState({ key, data, updatedAt: new Date() });
        },
        (e: unknown) => {
          if (__DEV__) console.warn('live query failed:', e);
        },
      );
    };
    load();
    const listener = addDatabaseChangeListener(({ tableName }) => {
      if (tables.includes(tableName)) load();
    });
    return () => {
      live = false;
      listener.remove();
    };
    // The query is rebuilt on every render; the deps say when it means something else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state.key === key ? state : { data: NONE, updatedAt: undefined };
}
