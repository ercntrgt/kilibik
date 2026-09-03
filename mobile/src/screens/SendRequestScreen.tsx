import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ApiError, api } from '../api/client';
import { Button, ErrorText, Field, Screen, Title, colors } from '../components/ui';
import { QUICK_TEMPLATES } from '../config';
import { encryptRequest } from '../crypto/envelope';
import { t } from '../i18n/tr';
import { useSession } from '../store/session';

/** Serbest metin + hızlı şablonlar. Metin cihazda şifrelenir. Sınır: saatte 10 (sunucu). */
export function SendRequestScreen() {
  const session = useSession();
  const nav = useNavigation();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!session.sharedKey || !text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api('POST', '/requests', { body_encrypted: encryptRequest(session.sharedKey, text.trim()) });
      nav.goBack();
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'request_rate_limited' ? t.rateLimited : t.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title>{t.newRequest}</Title>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {QUICK_TEMPLATES.map((q) => (
          <Pressable key={q} onPress={() => setText(q)} style={{ backgroundColor: colors.card, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 }}>
            <Text style={{ color: colors.text }}>{q}</Text>
          </Pressable>
        ))}
      </View>
      <Field value={text} onChangeText={setText} placeholder={t.requestPlaceholder} maxLength={300} multiline autoFocus />
      <ErrorText>{error}</ErrorText>
      <Button title={t.send} onPress={send} loading={loading} disabled={!text.trim()} />
    </Screen>
  );
}
