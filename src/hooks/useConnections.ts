'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Connection } from '@/lib/types';
import { apiFetch } from '@/lib/api';

export interface InviteLink {
  code: string;
  url: string;
  expiresAt: string;
}

/** Creates a one-time invite link (7 days). With roomId the invitee also joins that course. */
export async function createInviteLink(roomId?: string | null): Promise<InviteLink> {
  const data = await apiFetch<{ code: string; path: string; expiresAt: string }>('/api/connections/invites', {
    method: 'POST',
    json: roomId ? { roomId } : {},
  });
  return { code: data.code, url: `${window.location.origin}${data.path}`, expiresAt: data.expiresAt };
}

/** People the user is connected with (함께하는 사람). `version` changes force a reload. */
export function useConnections(enabled: boolean, version = 0) {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    apiFetch<{ connections: Connection[] }>('/api/connections')
      .then((data) => { if (alive) setConnections(data.connections); })
      .catch(() => { if (alive) setConnections((prev) => prev ?? []); });
    return () => { alive = false; };
  }, [enabled, version, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const setAutoShare = useCallback(async (friendId: string, autoShare: boolean) => {
    setConnections((prev) => prev?.map((c) => (c.userId === friendId ? { ...c, autoShare } : c)) ?? prev);
    try {
      await apiFetch(`/api/connections/${friendId}`, { method: 'PATCH', json: { autoShare } });
    } catch (err) {
      setConnections((prev) => prev?.map((c) => (c.userId === friendId ? { ...c, autoShare: !autoShare } : c)) ?? prev);
      throw err;
    }
  }, []);

  const disconnect = useCallback(async (friendId: string) => {
    await apiFetch(`/api/connections/${friendId}`, { method: 'DELETE' });
    setConnections((prev) => prev?.filter((c) => c.userId !== friendId) ?? prev);
  }, []);

  return { connections, reload, setAutoShare, disconnect };
}
