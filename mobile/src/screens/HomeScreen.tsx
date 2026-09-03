import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import type { RequestView } from '../../../shared/src/types';
import { api } from '../api/client';
import { Body, Button, Card, Screen, Title, colors, timeAgo } from '../components/ui';
import { decryptRequest } from '../crypto/envelope';
import { t } from '../i18n/tr';
import type { RootStackParams } from '../navigation/types';
import { subscribeForeground } from '../push';
import { useSession } from '../store/session';

interface Item extends RequestView {
  text: string;
}

const STATUS_LABEL: Record<RequestView['status'], string> = {
  pending: t.pending,
  accepted: t.accepted,
  declined: t.declined,
  snoozed: t.snoozed,
};

/** Ana ekran: gönderdiklerin ve sana gelenler aynı listede. Hiçbir istatistik yok. */
export function HomeScreen() {
  const session = useSession();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [items, setItems] = useState<Item[]>([]);

  const load = useCallback(async () => {
    if (!session.sharedKey) return;
    const key = session.sharedKey;
    try {
      const r = await api<{ requests: RequestView[] }>('GET', '/requests');
      setItems(
        r.requests.map((x) => {
          let text = '…';
          try {
            text = decryptRequest(key, x.body_encrypted);
          } catch {
            text = '(çözülemedi)';
          }
          return { ...x, text };
        }),
      );
    } catch {
      /* çevrimdışı */
    }
  }, [session.sharedKey]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const id = setInterval(load, 20_000);
      return () => clearInterval(id);
    }, [load]),
  );
  useEffect(() => subscribeForeground((kind) => (kind === 'request' || kind === 'request_response') && void load()), [load]);

  const respond = async (id: string, status: 'accepted' | 'declined' | 'snoozed') => {
    await api('POST', `/requests/${id}/respond`, { status });
    await load();
  };

  return (
    <Screen scroll={false}>
      <Title>{t.tabHome}</Title>
      <Button title={t.newRequest} onPress={() => nav.navigate('SendRequest')} />
      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
        ListEmptyComponent={<Body muted>{t.homeEmpty}</Body>}
        renderItem={({ item }) => {
          const mine = item.sender_id === session.userId;
          const canRespond = !mine && (item.status === 'pending' || item.status === 'snoozed');
          return (
            <Card>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {mine ? t.fromYou : t.fromPartner} · {timeAgo(item.created_at)}
              </Text>
              <Text style={{ fontSize: 17, color: colors.text }}>{item.text}</Text>
              <Text style={{ color: colors.muted }}>{STATUS_LABEL[item.status]}</Text>
              {canRespond && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button title={t.accepted} onPress={() => respond(item.id, 'accepted')} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title={t.declined} variant="secondary" onPress={() => respond(item.id, 'declined')} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title={t.snoozed} variant="secondary" onPress={() => respond(item.id, 'snoozed')} />
                  </View>
                </View>
              )}
            </Card>
          );
        }}
      />
    </Screen>
  );
}
