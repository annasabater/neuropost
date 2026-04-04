import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://neuropost.es', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://neuropost.es/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://neuropost.es/pricing', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://neuropost.es/blog', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: 'https://neuropost.es/legal/privacidad', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://neuropost.es/legal/terminos', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://neuropost.es/legal/cookies', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://neuropost.es/legal/aviso-legal', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://neuropost.es/status', lastModified: new Date(), changeFrequency: 'always', priority: 0.4 },
  ]
}
