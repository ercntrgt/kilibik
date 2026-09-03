import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { t } from '../i18n/tr';
import { locationController } from '../location/controller';
import { subscribeForeground } from '../push';
import { HomeScreen } from '../screens/HomeScreen';
import { LegalDocScreen } from '../screens/LegalDocScreen';
import { MapScreen } from '../screens/MapScreen';
import { NudgeScreen } from '../screens/NudgeScreen';
import { SendRequestScreen } from '../screens/SendRequestScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AgeScreen } from '../screens/onboarding/AgeScreen';
import { ConsentScreen } from '../screens/onboarding/ConsentScreen';
import { OtpScreen } from '../screens/onboarding/OtpScreen';
import { PairScreen } from '../screens/onboarding/PairScreen';
import { PhoneScreen } from '../screens/onboarding/PhoneScreen';
import { PrivacyNoticeScreen } from '../screens/onboarding/PrivacyNoticeScreen';
import { useSession } from '../store/session';
import type { AuthStackParams, MainTabParams, RootStackParams } from './types';

const Auth = createNativeStackNavigator<AuthStackParams>();
const Root = createNativeStackNavigator<RootStackParams>();
const Tabs = createBottomTabNavigator<MainTabParams>();

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: t.tabHome }} />
      <Tabs.Screen name="Map" component={MapScreen} options={{ title: t.tabMap }} />
      <Tabs.Screen name="Nudge" component={NudgeScreen} options={{ title: t.tabNudge }} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ title: t.tabSettings }} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const session = useSession();

  // Eşleşme bitince (partner sonlandırdı / hesabını sildi) sessizce eşleşme ekranına dön.
  useEffect(() => subscribeForeground((kind) => (kind === 'pair' || kind === 'pair_dissolved') && void session.refreshMe()), [session]);
  // Uygulama açılışında paylaşım açıksa konum denetleyicisini başlat.
  useEffect(() => {
    if (session.me?.location_sharing_enabled && session.sharedKey) locationController.start(session.sharedKey);
    else locationController.stop();
  }, [session.me?.location_sharing_enabled, session.sharedKey]);

  if (session.booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!session.token ? (
        <Auth.Navigator screenOptions={{ headerShown: false }}>
          <Auth.Screen name="Age" component={AgeScreen} />
          <Auth.Screen name="PrivacyNotice" component={PrivacyNoticeScreen} />
          <Auth.Screen name="Consent" component={ConsentScreen} />
          <Auth.Screen name="Phone" component={PhoneScreen} />
          <Auth.Screen name="Otp" component={OtpScreen} />
        </Auth.Navigator>
      ) : !session.me?.pair ? (
        <PairScreen />
      ) : (
        <Root.Navigator>
          <Root.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
          <Root.Screen name="SendRequest" component={SendRequestScreen} options={{ presentation: 'modal', title: t.newRequest }} />
          <Root.Screen name="LegalDoc" component={LegalDocScreen} options={({ route }) => ({ title: route.params.title })} />
        </Root.Navigator>
      )}
    </NavigationContainer>
  );
}
