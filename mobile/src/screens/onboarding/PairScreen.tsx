import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { PairView } from '../../../../shared/src/types';
import { ApiError, api } from '../../api/client';
import { Body, Button, Card, ErrorText, Field, Screen, Title, colors } from '../../components/ui';
import { t } from '../../i18n/tr';
import { useSession } from '../../store/session';

/** Eşleşme: QR / 8 haneli tek kullanımlık kod. Bir hesap tek eşleşme. */
export function PairScreen() {
  const session = useSession();
  const [mode, setMode] = useState<'choose' | 'show' | 'enter'>('choose');
  const [code, setCode] = useState('');
  const [entered, setEntered] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Davet gösterilirken partnerin kabul etmesini bekle (push + 5 sn'de bir kontrol).
  useEffect(() => {
    if (mode !== 'show') return;
    const id = setInterval(async () => {
      const me = await session.refreshMe();
      if (me?.pair) clearInterval(id);
    }, 5000);
    return () => clearInterval(id);
  }, [mode, session]);

  const createInvite = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ code: string }>('POST', '/pair/invite');
      setCode(r.code);
      setMode('show');
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  const accept = async () => {
    setLoading(true);
    setError(null);
    try {
      const pair = await api<PairView>('POST', '/pair/accept', { code: entered.trim().toUpperCase() });
      session.adoptPair(pair);
      await session.refreshMe();
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'invite_not_found' ? 'Kod bulunamadı veya süresi doldu.' : t.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title>{t.pairTitle}</Title>
      <Body>{t.pairBody}</Body>
      {mode === 'choose' && (
        <>
          <Button title={t.pairCreate} onPress={createInvite} loading={loading} />
          <Button title={t.pairEnter} variant="secondary" onPress={() => setMode('enter')} />
        </>
      )}
      {mode === 'show' && (
        <Card>
          <View style={{ alignItems: 'center', gap: 12 }}>
            <QRCode value={code} size={180} />
            <Text style={{ fontSize: 28, letterSpacing: 6, fontWeight: '700', color: colors.text }}>{code}</Text>
            <Body muted>{t.pairWaiting}</Body>
          </View>
        </Card>
      )}
      {mode === 'enter' && (
        <>
          <Field value={entered} onChangeText={setEntered} autoCapitalize="characters" maxLength={8} placeholder="ABCD2345" autoFocus />
          <Button title={t.continue} onPress={accept} loading={loading} disabled={entered.trim().length !== 8} />
        </>
      )}
      <ErrorText>{error}</ErrorText>
      {mode !== 'choose' && <Button title={t.cancel} variant="secondary" onPress={() => setMode('choose')} />}
    </Screen>
  );
}
