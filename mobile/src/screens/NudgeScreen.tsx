import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../api/client';
import { Body, Button, Card, Screen, Title } from '../components/ui';
import { t } from '../i18n/tr';
import { subscribeForeground } from '../push';

/** Tek buton, 15 dk cooldown. */
export function NudgeScreen() {
  const [cooldown, setCooldown] = useState(0);
  const [pendingAt, setPendingAt] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api<{ cooldown_remaining: number; pending_at: string | null }>('GET', '/nudge/status');
      setCooldown(s.cooldown_remaining);
      setPendingAt(s.pending_at);
    } catch {
      /* çevrimdışı */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
      return () => clearInterval(id);
    }, [load]),
  );
  useEffect(() => subscribeForeground((kind) => kind === 'nudge' && void load()), [load]);

  const nudge = async () => {
    try {
      await api('POST', '/nudge');
      setSent(true);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'nudge_cooldown') setCooldown(e.retryAfter ?? 900);
    }
  };

  return (
    <Screen>
      <Title>{t.tabNudge}</Title>
      {pendingAt && (
        <Card>
          <Body>{t.nudgeIncoming}</Body>
          <Button
            title="Gördüm"
            variant="secondary"
            onPress={async () => {
              await api('DELETE', '/nudge/pending');
              setPendingAt(null);
            }}
          />
        </Card>
      )}
      <Button title={cooldown > 0 ? t.nudgeCooldown(Math.ceil(cooldown / 60)) : t.nudgeButton} onPress={nudge} disabled={cooldown > 0} />
      {sent && cooldown > 0 && <Body muted>{t.nudgeSent}</Body>}
    </Screen>
  );
}
