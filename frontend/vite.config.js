import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plain HTTP dev server. http://localhost is already a "secure context",
// so camera (getUserMedia) and GPS (geolocation) work without HTTPS.
// The proxy forwards API calls to XAMPP Apache so there are no CORS issues.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Forward all backend API requests through Vite → Apache (port 80).
      '/GeoAttendPro/backend/public': {
        target: 'http://localhost',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
