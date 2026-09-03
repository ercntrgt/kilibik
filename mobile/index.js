import messaging from '@react-native-firebase/messaging';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { displayLocal, kindOf } from './src/push';

// Arka plan / kapalı uygulama: içerik cihazda üretilir. Sessiz türler gösterilmez.
messaging().setBackgroundMessageHandler(async (msg) => {
  const kind = kindOf(msg);
  if (kind) await displayLocal(kind);
});

AppRegistry.registerComponent(appName, () => App);
