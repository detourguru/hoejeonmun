import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '회전문',
    short_name: '회전문',
    description: '공연 관련 정보를 제공하는 웹 애플리케이션',
    start_url: '/',
    display: 'standalone',
    background_color: '#23285e',
    theme_color: '#23285e',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}