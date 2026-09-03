import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { api } from '../api/client';
import { Body, Button, Card, Screen, Title, colors } from '../components/ui';
import { t } from '../i18n/tr';
import { locationController } from '../location/controller';
import { capabilitiesFor } from '../logic/permissions';
import type { RootStackParams } from '../navigation/types';
import { useSession } from '../store/session';

/**
 * Ayarlar.
 * - Konum paylaşımı: tek dokunuş, onay yok, gecikme yok, partnere bildirim yok.
 * - Hesabı sil: ana ekrandan 3 dokunuş (Ayarlar → Hesabı sil → Evet, sil).
 */
export function SettingsScreen() {
  const session = useSession();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const enabled = session.me?.location_sharing_enabled ?? false;
  const hasConsent = session.me?.consents.location_consent_version != null;
  const [permNote, setPermNote] = useState<string | null>(null);

  // Paylaşım açık ve anahtar varsa denetleyiciyi çalıştır; kapalıysa durdur.
  useEffect(() => {
    if (enabled && session.sharedKey) locationController.start(session.sharedKey);
    else locationController.stop();
  }, [enabled, session.sharedKey]);

  const toggle = async (value: boolean) => {
    if (value) {
      if (!hasConsent) {
        Alert.alert(t.consentTitle, t.consentNote);
        return;
      }
      const perm = await locationController.requestPermission(true);
      const cap = capabilitiesFor(perm);
      if (cap.ownSharing === 'unavailable') {
        setPermNote(t.mapNoPermission);
        return; // izin yok: paylaşım kapalı kalır, geri kalan çalışır
      }
      setPermNote(cap.ownSharing === 'foreground_only' ? 'Yalnızca uygulama açıkken paylaşılır.' : null);
    } else {
      locationController.stop();
    }
    await api('PUT', '/sharing', { location_sharing_enabled: value });
    await session.refreshMe();
  };

  const withdrawConsent = async () => {
    locationController.stop();
    await api('DELETE', '/me/consents/location');
    await session.refreshMe();
  };

  const endPair = async () => {
    locationController.stop();
    await api('DELETE', '/pair');
    await session.refreshMe();
  };

  // Dokunuş 2: "Hesabı sil" → Dokunuş 3: "Evet, sil"
  const deleteAccount = () =>
    Alert.alert(t.deleteConfirmTitle, t.deleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.deleteYes, style: 'destructive', onPress: () => void session.deleteAccount() },
    ]);

  const legal = (slug: RootStackParams['LegalDoc']['slug'], title: string) => nav.navigate('LegalDoc', { slug, title });

  return (
    <Screen>
      <Title>{t.tabSettings}</Title>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 17, color: colors.text }}>{t.sharingToggle}</Text>
          <Switch value={enabled} onValueChange={toggle} testID="sharing-toggle" />
        </View>
        <Body muted>{t.sharingHint}</Body>
        {permNote && <Body muted>{permNote}</Body>}
        {hasConsent && <Button title={t.withdrawConsent} variant="secondary" onPress={withdrawConsent} />}
      </Card>
      <Card>
        <Button title={t.legalNotice} variant="secondary" onPress={() => legal('privacy-notice', t.legalNotice)} />
        <Button title={t.legalConsent} variant="secondary" onPress={() => legal('location-consent', t.legalConsent)} />
        <Button title={t.legalPolicy} variant="secondary" onPress={() => legal('privacy-policy', t.legalPolicy)} />
        <Button title={t.legalRetention} variant="secondary" onPress={() => legal('retention', t.legalRetention)} />
      </Card>
      <Button title={t.endPair} variant="secondary" onPress={endPair} />
      <Button title={t.deleteAccount} variant="danger" onPress={deleteAccount} testID="delete-account" />
    </Screen>
  );
}
