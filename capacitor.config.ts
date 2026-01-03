
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fruitpro.app',
  appName: 'FruitPro',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
