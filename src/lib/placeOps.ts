import type { CoursePlace, PlaceUpdatableFields } from './types';

/*
 * Turns "old list → new list" into the minimal server operations, so UI code can keep
 * producing whole lists while the server only receives small, mergeable changes.
 */

export interface PlaceOps {
  added: CoursePlace[];
  removedIds: string[];
  patches: { id: string; fields: PlaceUpdatableFields }[];
  reactions: { id: string; emoji: string | null }[];
  /** Full order to apply, or null when ordering and day assignment are unchanged */
  order: { id: string; day: number }[] | null;
}

const PATCHABLE: (keyof PlaceUpdatableFields)[] = ['memo', 'isHold', 'stayMinutes', 'cost', 'visitedAt', 'rating', 'review'];

function norm(value: unknown): unknown {
  if (value === undefined || value === '') return null;
  return value;
}

export function diffPlaces(prev: CoursePlace[], next: CoursePlace[], userId: string | null): PlaceOps {
  const prevById = new Map(prev.map((p) => [p.id, p]));
  const nextIds = new Set(next.map((p) => p.id));

  const added = next.filter((p) => !prevById.has(p.id));
  const removedIds = prev.filter((p) => !nextIds.has(p.id)).map((p) => p.id);

  const patches: PlaceOps['patches'] = [];
  const reactions: PlaceOps['reactions'] = [];
  for (const p of next) {
    const old = prevById.get(p.id);
    if (!old) continue;
    const fields: PlaceUpdatableFields = {};
    for (const key of PATCHABLE) {
      if (key === 'isHold') {
        if (!!old.isHold !== !!p.isHold) fields.isHold = !!p.isHold;
      } else if (norm(old[key]) !== norm(p[key])) {
        (fields as Record<string, unknown>)[key] = p[key] ?? null;
      }
    }
    if (Object.keys(fields).length > 0) patches.push({ id: p.id, fields });

    if (userId) {
      const before = old.reactions?.[userId] ?? null;
      const after = p.reactions?.[userId] ?? null;
      if (before !== after) reactions.push({ id: p.id, emoji: after });
    }
  }

  const seq = (list: CoursePlace[], keep: (p: CoursePlace) => boolean) =>
    list.filter(keep).map((p) => `${p.id}:${p.day ?? 0}`).join('|');
  const orderChanged =
    added.length > 0 ||
    seq(prev, (p) => nextIds.has(p.id)) !== seq(next, (p) => prevById.has(p.id));

  return {
    added,
    removedIds,
    patches,
    reactions,
    order: orderChanged ? next.map((p) => ({ id: p.id, day: p.day ?? 0 })) : null,
  };
}

/** True when membership, order or day assignment changed (the drawn route is then stale). */
export function isStructuralChange(ops: PlaceOps): boolean {
  return ops.added.length > 0 || ops.removedIds.length > 0 || ops.order !== null;
}

/** Signature of membership + order + days; compares server lists without caring about memos etc. */
export function structureKey(list: CoursePlace[]): string {
  return list.map((p) => `${p.id}:${p.day ?? 0}`).join('|');
}
