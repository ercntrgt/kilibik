import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { LocationPlain, PartnerLocationView, PartnerView } from '../../../shared/src/types';
import { api } from '../api/client';
import { Screen, Title, colors, timeAgo } from '../components/ui';
import { decryptLocation } from '../crypto/envelope';
import { t } from '../i18n/tr';
import { locationController } from '../location/controller';
import { subscribeForeground } from '../push';
import { useSession } from '../store/session';

interface PartnerState {
  view: PartnerLocationView | null;
  plain: LocationPlain | null;
  sharing: boolean | null;
}

/**
 * Harita: iki avatar, iki son konum, iki zaman damgası.
 * Partner kapalıysa gri avatar + nötr "Konum paylaşımı kapalı". Yargı yok, süre yok.
 */
export function MapScreen() {
  const session = useSession();
  const [partner, setPartner] = useState<PartnerState>({ view: null, plain: null, sharing: null });
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!session.sharedKey) return;
    try {
      const [p, loc] = await Promise.all([api<PartnerView>('GET', '/partner'), api<PartnerLocationView>('GET', '/location/partner')]);
      let plain: LocationPlain | null = null;
      if (loc.state === 'fresh') {
        try {
          plain = decryptLocation(session.sharedKey, loc.blob);
        } catch {
          plain = null;
        }
      }
      setPartner({ view: loc, plain, sharing: p.location_sharing_enabled });
    } catch {
      /* çevrimdışı */
    }
  }, [session.sharedKey]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const id = setInterval(() => {
        void load();
        setTick((x) => x + 1);
      }, 30_000);
      return () => clearInterval(id);
    }, [load]),
  );
  useEffect(() => subscribeForeground((kind) => kind === 'location' && void load()), [load]);

  const mine = locationController.current;
  const mySharing = session.me?.location_sharing_enabled ?? false;
  const focus = partner.plain ?? (mine ? { lat: mine.lat, lng: mine.lng } : { lat: 41.0082, lng: 28.9784 });

  const partnerStatus = (() => {
    if (partner.sharing === false) return t.mapOff;
    if (!partner.view || partner.view.state === 'stale') return t.mapStale;
    if (partner.view.state === 'off') return t.mapOff;
    return t.mapUpdated(timeAgo(partner.view.updated_at));
  })();
  const partnerGray = partner.sharing === false || partner.view?.state !== 'fresh';

  return (
    <Screen scroll={false}>
      <Title>{t.tabMap}</Title>
      <MapView
        style={styles.map}
        key={tick === 0 ? 'init' : 'live'}
        initialRegion={{ latitude: focus.lat, longitude: focus.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {partner.plain && (
          <Marker coordinate={{ latitude: partner.plain.lat, longitude: partner.plain.lng }} title={t.mapPartner} pinColor={colors.primary} />
        )}
        {mine && mySharing && <Marker coordinate={{ latitude: mine.lat, longitude: mine.lng }} title={t.mapYou} pinColor={colors.gray} />}
      </MapView>
      <View style={styles.legend}>
        <Row label={t.mapPartner} value={partnerStatus} gray={partnerGray} />
        <Row label={t.mapYou} value={mySharing ? (mine ? t.mapUpdated(timeAgo(new Date(mine.at).toISOString())) : '…') : t.mapYourSharingOff} gray={!mySharing} />
      </View>
    </Screen>
  );
}

function Row({ label, value, gray }: { label: string; value: string; gray: boolean }) {
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: gray ? colors.gray : colors.primary }]} />
      <Text style={{ fontWeight: '600', color: colors.text }}>{label}</Text>
      <Text style={{ color: colors.muted, flex: 1 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { height: 360, borderRadius: 12 },
  legend: { gap: 8, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 16, height: 16, borderRadius: 8 },
});
