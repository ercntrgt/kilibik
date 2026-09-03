import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { api } from '../api/client';
import { Screen, Title, colors } from '../components/ui';
import type { RootStackParams } from '../navigation/types';

/** Uyum metinleri sunucudan (markdown) çekilir; sade düz metin olarak gösterilir. */
export function LegalDocView({ slug, compact }: { slug: RootStackParams['LegalDoc']['slug']; compact?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    api<string>('GET', `/legal/${slug}`)
      .then((md) => setText(md.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\|/g, ' ')))
      .catch(() => setText('Metin yüklenemedi. Bağlantını kontrol et.'));
  }, [slug]);
  if (text === null) return <ActivityIndicator />;
  const inner = <Text style={{ fontSize: 14, lineHeight: 20, color: colors.text }}>{text}</Text>;
  return compact ? (
    <View style={{ maxHeight: 280, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 }}>
      <ScrollView nestedScrollEnabled>{inner}</ScrollView>
    </View>
  ) : (
    inner
  );
}

export function LegalDocScreen({ route }: NativeStackScreenProps<RootStackParams, 'LegalDoc'>) {
  return (
    <Screen>
      <Title>{route.params.title}</Title>
      <LegalDocView slug={route.params.slug} />
    </Screen>
  );
}
