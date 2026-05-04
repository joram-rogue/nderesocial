import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.50d2b1f0b38a4148969cbcc0979d5337',
  appName: 'nderesocial',
  webDir: 'dist',
  server: {
    url: 'https://50d2b1f0-b38a-4148-969c-bcc0979d5337.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    backgroundColor: '#1a0f0a',
  },
  ios: {
    backgroundColor: '#1a0f0a',
    contentInset: 'always',
  },
};

export default config;
