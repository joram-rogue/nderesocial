import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.joram.nderesocial',
  appName: 'Ndere Social',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
