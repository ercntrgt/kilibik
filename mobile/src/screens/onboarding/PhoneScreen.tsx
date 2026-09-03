import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ApiError, api } from '../../api/client';
import { Body, Button, ErrorText, Field, Screen, Title } from '../../components/ui';
import { t } from '../../i18n/tr';
import type { AuthStackParams } from '../../navigation/types';

export function PhoneScreen({ navigation, route }: NativeStackScreenProps<AuthStackParams, 'Phone'>) {
  const [phone, setPhone] = useState('+90');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <Title>{t.phoneTitle}</Title>
      <Body muted>{t.phoneHint}</Body>
      <Field value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoFocus />
      <ErrorText>{error}</ErrorText>
      <Button
        title={t.continue}
        loading={loading}
        onPress={async () => {
          setLoading(true);
          setError(null);
          try {
            await api('POST', '/auth/otp/request', { phone });
            navigation.navigate('Otp', { ...route.params, phone });
          } catch (e) {
            setError(e instanceof ApiError && e.status === 429 ? `Çok sık denendi. ${e.retryAfter ?? 60} sn sonra tekrar dene.` : 'Numara geçersiz görünüyor.');
          } finally {
            setLoading(false);
          }
        }}
      />
    </Screen>
  );
}
