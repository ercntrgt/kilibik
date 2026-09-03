import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { LOCATION_CONSENT_VERSION, PRIVACY_NOTICE_VERSION } from '../../../../shared/src/constants';
import { ApiError, api } from '../../api/client';
import { Body, Button, ErrorText, Field, Screen, Title } from '../../components/ui';
import { t } from '../../i18n/tr';
import type { AuthStackParams } from '../../navigation/types';
import { registerPushToken } from '../../push';
import { useSession } from '../../store/session';

export function OtpScreen({ route }: NativeStackScreenProps<AuthStackParams, 'Otp'>) {
  const { phone, birthDate, locationConsent } = route.params;
  const session = useSession();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <Title>{t.otpTitle}</Title>
      <Body muted>{t.otpHint}</Body>
      <Field value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoFocus />
      <ErrorText>{error}</ErrorText>
      <Button
        title={t.continue}
        loading={loading}
        disabled={code.length !== 6}
        onPress={async () => {
          setLoading(true);
          setError(null);
          try {
            // Doğum tarihi yalnızca bu istekte gider; sunucu saklamaz.
            const r = await api<{ token: string; user_id: string }>('POST', '/auth/otp/verify', { phone, code, birth_date: birthDate });
            await session.signIn(r.token, r.user_id);
            await api('POST', '/me/consents', { kind: 'privacy_notice', version: PRIVACY_NOTICE_VERSION });
            if (locationConsent) await api('POST', '/me/consents', { kind: 'location', version: LOCATION_CONSENT_VERSION });
            await session.setOnboarded(true);
            try {
              await registerPushToken();
            } catch {
              /* bildirim izni reddedildi; uygulama çalışmaya devam eder */
            }
          } catch (e) {
            if (e instanceof ApiError && e.code === 'underage') setError(t.ageTooYoung);
            else if (e instanceof ApiError && e.code === 'invalid_code') setError('Kod yanlış veya süresi doldu.');
            else setError(t.error);
          } finally {
            setLoading(false);
          }
        }}
      />
    </Screen>
  );
}
