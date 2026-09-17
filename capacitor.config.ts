import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mas.mats',
  appName: 'MATS',
  webDir: 'dist',
  server: {
    url: 'https://mats-c10da.web.app',
    cleartext: false,
    androidScheme: 'https'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notification',
      iconColor: '#10B981',
      sound: 'default'
    }
  }
};

export default config;
