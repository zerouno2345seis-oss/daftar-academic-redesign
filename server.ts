import express from 'express';
import path from 'path';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import yts from 'yt-search';
import ytpl from 'ytpl';

export const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// CORS middleware for Vercel and local dev
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

  const youtubeHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
  };

  function getContinuationToken(value: any): string | null {
    if (!value || typeof value !== 'object') return null;

    if (value.continuationItemRenderer) {
      const endpoint = value.continuationItemRenderer.continuationEndpoint;
      const token = endpoint?.continuationCommand?.token
        || endpoint?.commandExecutorCommand?.commands?.[0]?.continuationCommand?.token;
      if (typeof token === 'string') return token;
    }

    for (const child of Object.values(value)) {
      const token = getContinuationToken(child);
      if (token) return token;
    }
    return null;
  }

  function parseYouTubeSearchResults(value: any) {
    const videos: any[] = [];
    const channels: any[] = [];
    const seenVideoIds = new Set<string>();
    const seenChannelIds = new Set<string>();

    const addVideo = (renderer: any) => {
      const videoId = renderer?.videoId;
      if (!videoId || seenVideoIds.has(videoId)) return;
      seenVideoIds.add(videoId);

      const title = renderer.title?.runs?.map((run: any) => run.text).join('')
        || renderer.title?.simpleText
        || 'فيديو يوتيوب';
      const channelUrlPath = renderer.ownerText?.runs?.[0]?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
      const thumbnails = renderer.thumbnail?.thumbnails;
      videos.push({
        id: videoId,
        title,
        duration: renderer.lengthText?.simpleText || 'N/A',
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: thumbnails?.[thumbnails.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        thumbnailAlt: title,
        selected: true,
        channelTitle: renderer.ownerText?.runs?.[0]?.text || 'قناة يوتيوب',
        channelUrl: channelUrlPath ? `https://www.youtube.com${channelUrlPath}` : '',
        views: renderer.viewCountText?.simpleText || renderer.shortViewCountText?.simpleText || '',
        publishedAt: renderer.publishedTimeText?.simpleText || ''
      });
    };

    const addChannel = (renderer: any) => {
      const channelId = renderer?.channelId;
      const urlPath = renderer?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
      const url = urlPath ? `https://www.youtube.com${urlPath}` : `https://www.youtube.com/channel/${channelId}`;
      const key = channelId || url;
      if (!key || seenChannelIds.has(key)) return;
      seenChannelIds.add(key);

      const name = renderer.title?.simpleText || renderer.title?.runs?.[0]?.text || 'قناة يوتيوب';
      const thumbnails = renderer.thumbnail?.thumbnails;
      channels.push({
        id: channelId || url,
        name,
        url,
        avatar: thumbnails?.[thumbnails.length - 1]?.url || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200&auto=format&fit=crop&q=60',
        subscribers: renderer.subscriberCountText?.simpleText || '',
        videoCount: renderer.videoCountText?.runs?.[0]?.text || renderer.videoCountText?.simpleText || '',
        description: renderer.descriptionSnippet?.runs?.map((run: any) => run.text).join('') || name
      });
    };

    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.videoRenderer) {
        addVideo(node.videoRenderer);
        return;
      }
      if (node.channelRenderer) {
        addChannel(node.channelRenderer);
        return;
      }
      for (const child of Object.values(node)) visit(child);
    };

    visit(value);
    return { videos, channels };
  }

  // Direct YouTube search scraper. Pages after the first follow YouTube's
  // own continuation token, so "Load more" does not repeat the first page.
  async function scrapeYouTubeSearchHTML(query: string, page: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const response = await fetch(url, { signal: controller.signal, headers: youtubeHeaders });
      if (!response.ok) return { videos: [], channels: [] };

      const html = await response.text();
      const initialDataMatch = html.match(/(?:var\s+ytInitialData|window\["ytInitialData"\])\s*=\s*({[\s\S]+?});\s*</);
      const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
      if (!initialDataMatch?.[1]) return { videos: [], channels: [] };

      let data = JSON.parse(initialDataMatch[1]);
      let continuationToken = getContinuationToken(data);
      const apiKey = apiKeyMatch?.[1];

      for (let currentPage = 1; currentPage < page && continuationToken && apiKey; currentPage += 1) {
        const continuationResponse = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${apiKey}`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            ...youtubeHeaders,
            'Content-Type': 'application/json',
            'X-YouTube-Client-Name': '1',
            'X-YouTube-Client-Version': '2.20240101.00.00'
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: '2.20240101.00.00',
                hl: 'ar',
                gl: 'US'
              }
            },
            continuation: continuationToken
          })
        });
        if (!continuationResponse.ok) return { videos: [], channels: [] };
        data = await continuationResponse.json();
        continuationToken = getContinuationToken(data);
      }

      return parseYouTubeSearchResults(data);
    } catch (err) {
      console.warn('Scrape YouTube Search HTML failed:', err);
      return { videos: [], channels: [] };
    } finally {
      clearTimeout(timer);
    }
  }

  // Parallel Fallback search helper using public Invidious and Piped APIs
  async function fetchInvidiousOrPipedSearch(query: string, page: number) {
    const instances = [
      'https://pipedapi.kavin.rocks/search?q=' + encodeURIComponent(query) + '&filter=all&page=' + page,
      'https://api.piped.privacydev.net/search?q=' + encodeURIComponent(query) + '&filter=all&page=' + page,
      'https://inv.tux.pizza/api/v1/search?q=' + encodeURIComponent(query) + '&page=' + page,
      'https://invidious.nerdvpn.de/api/v1/search?q=' + encodeURIComponent(query) + '&page=' + page,
      'https://yewtu.be/api/v1/search?q=' + encodeURIComponent(query) + '&page=' + page
    ];

    const fetchSingle = async (url: string) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
        clearTimeout(timer);
        if (!res.ok) return null;
        const data = await res.json();

        const videos: any[] = [];
        const channels: any[] = [];

        if (url.includes('piped')) {
          const items = data.items || [];
          for (const item of items) {
            if (item.type === 'stream' || item.url?.includes('/watch?v=')) {
              const vidId = item.url ? item.url.replace('/watch?v=', '') : `vid-${Math.random()}`;
              videos.push({
                id: vidId,
                title: item.title,
                duration: item.duration ? `${Math.floor(item.duration / 60)}:${(item.duration % 60).toString().padStart(2, '0')}` : 'N/A',
                url: `https://www.youtube.com/watch?v=${vidId}`,
                thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
                thumbnailAlt: item.title,
                selected: true,
                channelTitle: item.uploaderName || 'YouTube Channel',
                channelUrl: item.uploaderUrl ? `https://www.youtube.com${item.uploaderUrl}` : '',
                views: item.views ? `${item.views.toLocaleString()} views` : '',
                publishedAt: item.uploadedDate || ''
              });
            } else if (item.type === 'channel' || item.url?.includes('/channel/')) {
              channels.push({
                id: item.url || `chan-${Math.random()}`,
                name: item.name || item.title || 'قناة يوتيوب',
                url: item.url ? `https://www.youtube.com${item.url}` : '',
                avatar: item.thumbnail || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200&auto=format&fit=crop&q=60',
                subscribers: item.subscribers ? `${item.subscribers.toLocaleString()} subscribers` : '',
                videoCount: item.videos ? `${item.videos} videos` : '',
                description: item.description || 'قناة يوتيوب'
              });
            }
          }
        } else if (Array.isArray(data)) {
          for (const item of data) {
            if (item.type === 'video') {
              videos.push({
                id: item.videoId,
                title: item.title,
                duration: item.lengthSeconds ? `${Math.floor(item.lengthSeconds / 60)}:${(item.lengthSeconds % 60).toString().padStart(2, '0')}` : 'N/A',
                url: `https://www.youtube.com/watch?v=${item.videoId}`,
                thumbnail: item.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
                thumbnailAlt: item.title,
                selected: true,
                channelTitle: item.author || 'YouTube Channel',
                channelUrl: item.authorUrl ? `https://www.youtube.com${item.authorUrl}` : '',
                views: item.viewCount ? `${item.viewCount.toLocaleString()} views` : '',
                publishedAt: item.publishedText || ''
              });
            } else if (item.type === 'channel') {
              channels.push({
                id: item.authorId || item.authorUrl || `chan-${Math.random()}`,
                name: item.author || 'قناة يوتيوب',
                url: item.authorUrl ? `https://www.youtube.com${item.authorUrl}` : '',
                avatar: item.authorThumbnails?.[0]?.url || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200&auto=format&fit=crop&q=60',
                subscribers: item.subCount ? `${item.subCount.toLocaleString()} subscribers` : '',
                videoCount: item.videoCount ? `${item.videoCount} videos` : '',
                description: item.description || 'قناة يوتيوب'
              });
            }
          }
        }

        if (videos.length > 0 || channels.length > 0) {
          return { videos, channels };
        }
        return null;
      } catch {
        return null;
      }
    };

    const results = await Promise.allSettled(instances.map(url => fetchSingle(url)));
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value) {
        return res.value;
      }
    }

    return { videos: [], channels: [] };
  }

  // Parallel search runner combining yts, HTML Scraper, and Piped/Invidious APIs
  async function searchYouTubeParallel(query: string, page: number) {
    const timeoutMs = 10000;

    const tryYts = async () => {
      try {
        const ytsWithTimeout = Promise.race([
          // yt-search returns cumulative pages when `pages` is used. Slice
          // the requested page out of that cumulative result so page 2+ does
          // not repeat page one (pageStart alone cannot resume without the
          // continuation token from the first request).
          yts({ query, pages: page }).then((result: any) => {
            const pageSize = 20;
            const start = Math.max(0, (page - 1) * pageSize);
            return {
              ...result,
              videos: (result?.videos || []).slice(start, start + pageSize),
              channels: page === 1 ? (result?.channels || []) : []
            };
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('yts timeout')), timeoutMs))
        ]);
        const res = await ytsWithTimeout;
        const vids = (res?.videos || []).map((v: any) => ({
          id: v.videoId || v.url,
          title: v.title,
          duration: v.timestamp || (v.duration ? `${v.duration.seconds}s` : 'N/A'),
          url: v.url,
          thumbnail: v.thumbnail || v.image,
          thumbnailAlt: v.title,
          selected: true,
          channelTitle: v.author?.name || 'قناة يوتيوب',
          channelUrl: v.author?.url || '',
          views: v.views ? `${v.views.toLocaleString()} مشاهدة` : '',
          publishedAt: v.ago || ''
        }));
        const chans = (res?.channels || []).map((c: any) => ({
          id: c.channelId || c.url || `channel-${Date.now()}`,
          name: c.name || c.title,
          url: c.url,
          avatar: c.image || c.avatar || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200&auto=format&fit=crop&q=60',
          subscribers: c.subCountLabel || c.subscribers || '',
          videoCount: c.videoCount ? `${c.videoCount} فيديو` : '',
          description: c.about || 'قناة يوتيوب رسمية'
        }));
        return { videos: vids, channels: chans };
      } catch {
        return { videos: [], channels: [] };
      }
    };

    const tryScrape = async () => {
      try {
        return await scrapeYouTubeSearchHTML(query, page);
      } catch {
        return { videos: [], channels: [] };
      }
    };

    const tryFallback = async () => {
      try {
        return await fetchInvidiousOrPipedSearch(query, page);
      } catch {
        return { videos: [], channels: [] };
      }
    };

    let combinedVideos: any[] = [];
    let combinedChannels: any[] = [];

    const providers = [tryYts(), tryScrape(), tryFallback()];
    const results = await Promise.allSettled(providers);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        combinedVideos = [...combinedVideos, ...result.value.videos];
        combinedChannels = [...combinedChannels, ...result.value.channels];
      }
    }

    // Deduplicate videos
    const seenVideoIds = new Set<string>();
    const videos: any[] = [];
    for (const v of combinedVideos) {
      if (v.id && !seenVideoIds.has(v.id)) {
        seenVideoIds.add(v.id);
        videos.push(v);
      }
    }

    // Deduplicate channels
    const seenChannelIds = new Set<string>();
    const channels: any[] = [];
    for (const c of combinedChannels) {
      const cKey = c.url || c.name || c.id;
      if (cKey && !seenChannelIds.has(cKey)) {
        seenChannelIds.add(cKey);
        channels.push(c);
      }
    }

    // Direct search result link item as absolute guarantee so UI NEVER turns up empty
    if (page === 1 && videos.length === 0 && channels.length === 0) {
      videos.push({
        id: `yt-query-${Date.now()}`,
        title: `نتائج البحث عن: ${query}`,
        duration: 'رابط مباشر',
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60',
        thumbnailAlt: query,
        selected: true,
        channelTitle: 'بحث يوتيوب مباشر',
        channelUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        views: 'رابط بحث جديد',
        publishedAt: 'الآن'
      });
    }

    return { videos, channels };
  }

  // Real YouTube search handler
  const handleYouTubeSearchReq = async (req: express.Request, res: express.Response) => {
    try {
      const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const requestedPage = typeof req.query.page === 'string' ? req.query.page : '1';
      const page = Math.min(20, Math.max(1, parseInt(requestedPage, 10) || 1));
      if (!query.trim()) {
        return res.status(400).json({ error: 'Search query is required' });
      }
      if (query.length > 200) {
        return res.status(400).json({ error: 'Search query must be 200 characters or fewer' });
      }

      console.log(`[YouTube Search API] Fast Parallel Querying: "${query}", Page: ${page}`);
      const { videos, channels } = await searchYouTubeParallel(query, page);
      return res.json({ videos, channels, totalVideos: videos.length, totalChannels: channels.length });
    } catch (err: any) {
      console.error('[YouTube Search Error]:', err);
      const query = typeof req.query.q === 'string' ? req.query.q : 'بحث';
      return res.json({
        videos: [
          {
            id: `yt-fallback-${Date.now()}`,
            title: `نتائج البحث عن: ${query}`,
            duration: 'رابط مباشر',
            url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
            thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60',
            thumbnailAlt: query,
            selected: true,
            channelTitle: 'بحث يوتيوب',
            channelUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
            views: 'رابط',
            publishedAt: 'الآن'
          }
        ],
        channels: [],
        totalVideos: 1,
        totalChannels: 0
      });
    }
  };

  app.get('/api/youtube/search', handleYouTubeSearchReq);
  app.get('/youtube/search', handleYouTubeSearchReq);

  // Read lightweight Open Graph metadata for links received through the PWA
  // share target. This keeps browser CORS out of the client and gives shared
  // Facebook, article, and other external links a useful thumbnail preview.
  const isUnsafePreviewHost = (hostname: string) => {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
    if (isIP(host) === 4) {
      const octets = host.split('.').map(Number);
      return octets[0] === 10
        || octets[0] === 127
        || (octets[0] === 169 && octets[1] === 254)
        || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
        || (octets[0] === 192 && octets[1] === 168)
        || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)
        || (octets[0] === 198 && (octets[1] === 18 || octets[1] === 19))
        || octets[0] >= 224;
    }
    return isIP(host) === 6 && (
      host === '::' || host === '::1' || host.startsWith('fc') || host.startsWith('fd')
      || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')
      || host.startsWith('ff')
    );
  };

  const isPublicPreviewUrl = async (candidate: URL) => {
    if (!['http:', 'https:'].includes(candidate.protocol) || candidate.username || candidate.password || isUnsafePreviewHost(candidate.hostname)) {
      return false;
    }
    if (isIP(candidate.hostname)) return true;
    try {
      const addresses = await lookup(candidate.hostname, { all: true, verbatim: true });
      return addresses.length > 0 && addresses.every((address) => !isUnsafePreviewHost(address.address));
    } catch {
      return false;
    }
  };

  const decodePreviewEntities = (value: string) => value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();

  const extractPreviewMeta = (html: string, key: string) => {
    const escapedKey = key.replace(':', '\\:');
    const propertyFirst = new RegExp(`<meta[^>]+(?:property|name)=["']${escapedKey}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i');
    const contentFirst = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escapedKey}["'][^>]*>`, 'i');
    const match = html.match(propertyFirst) || html.match(contentFirst);
    return match?.[1] ? decodePreviewEntities(match[1]) : '';
  };

  app.get('/api/link-preview', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    let targetUrl: URL;
    try {
      targetUrl = new URL(rawUrl);
    } catch {
      return res.status(400).json({ error: 'A valid URL is required' });
    }

    if (!(await isPublicPreviewUrl(targetUrl))) {
      return res.status(400).json({ error: 'Unsupported preview URL' });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    try {
      let currentUrl = targetUrl;
      let response: Response | null = null;
      for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
        if (!(await isPublicPreviewUrl(currentUrl))) {
          return res.status(400).json({ error: 'Unsupported preview redirect' });
        }
        response = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DaftarLinkPreview/1.0)',
            Accept: 'text/html,application/xhtml+xml'
          }
        });
        if (response.status < 300 || response.status >= 400) break;
        const location = response.headers.get('location');
        if (!location || redirectCount === 3) return res.status(502).json({ error: 'Preview redirect limit reached' });
        currentUrl = new URL(location, currentUrl);
      }

      if (!response) return res.status(502).json({ error: 'Preview source unavailable' });
      if (!response.ok) return res.status(502).json({ error: 'Preview source unavailable' });
      const finalUrl = currentUrl;
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        return res.json({ url: finalUrl.toString(), title: finalUrl.hostname });
      }

      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      if (reader) {
        while (totalBytes < 1_000_000) {
          const chunk = await reader.read();
          if (chunk.done) break;
          const remaining = 1_000_000 - totalBytes;
          const value = chunk.value.slice(0, remaining);
          chunks.push(value);
          totalBytes += value.byteLength;
          if (value.byteLength < chunk.value.byteLength) break;
        }
      }
      const html = new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
      const imageValue = extractPreviewMeta(html, 'og:image')
        || extractPreviewMeta(html, 'og:image:url')
        || extractPreviewMeta(html, 'twitter:image');
      let image = '';
      if (imageValue) {
        try {
          const imageUrl = new URL(imageValue, targetUrl);
          if (['http:', 'https:'].includes(imageUrl.protocol) && !isUnsafePreviewHost(imageUrl.hostname)) image = imageUrl.toString();
        } catch {
          image = '';
        }
      }

      return res.json({
        url: finalUrl.toString(),
        title: extractPreviewMeta(html, 'og:title') || extractPreviewMeta(html, 'twitter:title') || finalUrl.hostname,
        description: extractPreviewMeta(html, 'og:description') || extractPreviewMeta(html, 'description') || extractPreviewMeta(html, 'twitter:description'),
        image
      });
    } catch (err) {
      console.warn('[Link Preview] Failed to fetch metadata:', err);
      return res.json({ url: targetUrl.toString(), title: targetUrl.hostname });
    } finally {
      clearTimeout(timer);
    }
  });

  // Helper function to resolve YouTube Channel ID and canonical info
  async function resolveChannelInfo(inputUrl: string, inputName: string) {
    let channelId: string | null = null;
    let canonicalName = inputName || inputUrl;
    let canonicalUrl = inputUrl.startsWith('http') ? inputUrl : `https://www.youtube.com/${inputUrl.startsWith('@') ? inputUrl : '@' + inputUrl}`;

    // Direct UC... match
    const ucMatch = (inputUrl + ' ' + inputName).match(/UC[a-zA-Z0-9_-]{22}/);
    if (ucMatch) {
      channelId = ucMatch[0];
    }

    // Only fetch canonical YouTube URLs. Channel input is user-controlled, so
    // never turn an arbitrary URL into an outbound server-side request.
    let fetchUrl: string | null = null;
    if (!channelId && inputUrl.startsWith('@')) {
      fetchUrl = `https://www.youtube.com/${inputUrl}`;
    } else if (!channelId && inputUrl) {
      try {
        const candidate = new URL(inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`);
        const isYouTubeHost = candidate.hostname === 'youtube.com' || candidate.hostname.endsWith('.youtube.com');
        if (candidate.protocol === 'https:' && isYouTubeHost) {
          fetchUrl = candidate.toString();
        }
      } catch {
        // A channel name is resolved safely through the yts fallback below.
      }
    }

    // Try scraping a validated YouTube channel URL for its ID and canonical title.
    if (fetchUrl) {
      try {
        const res = await fetch(fetchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
          }
        });

        if (res.ok) {
          const html = await res.text();
          const idMatch = html.match(/"(?:channelId|externalId|browseId)":"(UC[a-zA-Z0-9_-]{22})"/);
          if (idMatch && idMatch[1]) {
            channelId = idMatch[1];
          } else {
            const metaMatch = html.match(/<meta itemprop="channelId" content="(UC[a-zA-Z0-9_-]{22})">/);
            if (metaMatch && metaMatch[1]) {
              channelId = metaMatch[1];
            }
          }

          const titleMatch = html.match(/<meta property="og:title" content="(.*?)">/);
          if (titleMatch && titleMatch[1]) {
            canonicalName = titleMatch[1];
          }
        }
      } catch (err) {
        console.warn('[resolveChannelInfo scrape warning]:', err);
      }
    }

    // Fallback: yts channel search
    if (!channelId && canonicalName) {
      try {
        const searchRes = await yts(canonicalName);
        if (searchRes?.channels && searchRes.channels.length > 0) {
          const matchedChan = searchRes.channels[0];
          const matchedChannelMetadata = matchedChan as typeof matchedChan & {
            channelId?: string;
            id?: string;
          };
          canonicalName = matchedChan.name || canonicalName;
          canonicalUrl = matchedChan.url || canonicalUrl;
          const matchedChannelId = matchedChannelMetadata.channelId
            || matchedChannelMetadata.id
            || matchedChan.url?.match(/UC[a-zA-Z0-9_-]{22}/)?.[0];
          if (typeof matchedChannelId === 'string' && /^UC[a-zA-Z0-9_-]{22}$/.test(matchedChannelId)) {
            channelId = matchedChannelId;
          }
        }
      } catch (e) {
        console.warn('[resolveChannelInfo yts fallback warning]:', e);
      }
    }

    return { channelId, canonicalName, canonicalUrl };
  }

  // Helper to extract playlist ID from URL or input
  function extractPlaylistId(input: string): string | null {
    if (!input) return null;
    const clean = input.trim();
    const listMatch = clean.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (listMatch) return listMatch[1];
    if (/^(PL|UU|FL|OL|RD|CL)[a-zA-Z0-9_-]+$/.test(clean)) return clean;
    return null;
  }

  // Fetch videos from a YouTube Playlist ID (supports full pagination for playlists with 450, 924, 2000+ videos)
  async function getPlaylistVideos(playlistId: string) {
    const seenVideoIds = new Set<string>();
    const videos: any[] = [];
    let playlistTitle = `قائمة تشغيل (${playlistId})`;
    const pageUrl = `https://www.youtube.com/playlist?list=${playlistId}`;

    const addVideo = (v: { id: string; title?: string; duration?: string; channelTitle?: string; thumbnail?: string }) => {
      if (!v || !v.id || seenVideoIds.has(v.id)) return;
      seenVideoIds.add(v.id);
      videos.push({
        id: v.id,
        title: v.title || `فيديو ${v.id}`,
        duration: v.duration || 'N/A',
        url: `https://www.youtube.com/watch?v=${v.id}`,
        thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        thumbnailAlt: v.title || `فيديو ${v.id}`,
        selected: true,
        channelTitle: v.channelTitle || 'قائمة تشغيل',
        channelUrl: pageUrl,
        views: '',
        publishedAt: ''
      });
    };

    // --- Strategy 1: ytpl (Official YouTube playlist parser with limit: Infinity) ---
    try {
      console.log(`[Playlist Extraction] Running ytpl for ${playlistId}...`);
      const res = await ytpl(playlistId, { limit: Infinity });
      if (res && res.items && res.items.length > 0) {
        if (res.title) playlistTitle = res.title;
        for (const item of res.items) {
          addVideo({
            id: item.id,
            title: item.title,
            duration: item.duration || 'N/A',
            channelTitle: item.author?.name || res.author?.name || 'قائمة تشغيل',
            thumbnail: (item as any).bestThumbnail?.url || (item as any).thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`
          });
        }
        console.log(`[ytpl Success] Extracted ${videos.length} videos for playlist ${playlistId}`);
        return { playlistTitle, videos, total: videos.length };
      }
    } catch (e: any) {
      console.warn('[ytpl warning]:', e?.message || e);
    }

    // --- Strategy 2: Invidious Paginated Loop (page = 1..50) ---
    const invidiousInstances = [
      'https://inv.tux.pizza',
      'https://invidious.nerdvpn.de',
      'https://vid.puffyan.us',
      'https://inv.nadeko.net',
      'https://invidious.drgns.space'
    ];

    for (const instance of invidiousInstances) {
      if (videos.length > 300) break;
      try {
        console.log(`[Invidious Extraction] Attempting instance ${instance} for playlist ${playlistId}...`);
        let page = 1;
        let hasMore = true;
        while (hasMore && page <= 50) {
          const invUrl = `${instance}/api/v1/playlists/${playlistId}?page=${page}`;
          const invRes = await fetch(invUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (!invRes.ok) break;
          const invData = await invRes.json();
          if (invData.title && playlistTitle.startsWith('قائمة تشغيل')) {
            playlistTitle = invData.title;
          }
          if (!invData.videos || !Array.isArray(invData.videos) || invData.videos.length === 0) {
            hasMore = false;
            break;
          }
          for (const item of invData.videos) {
            addVideo({
              id: item.videoId,
              title: item.title,
              duration: item.lengthSeconds ? `${Math.floor(item.lengthSeconds / 60)}:${(item.lengthSeconds % 60).toString().padStart(2, '0')}` : 'N/A',
              channelTitle: item.author || 'قائمة تشغيل',
              thumbnail: item.videoThumbnails?.[0]?.url
            });
          }
          if (invData.videos.length < 100) {
            hasMore = false;
          } else {
            page++;
          }
        }
        if (videos.length > 0) {
          console.log(`[Invidious Success] Fetched ${videos.length} videos from ${instance}`);
          return { playlistTitle, videos, total: videos.length };
        }
      } catch (e: any) {
        console.warn(`[Invidious ${instance} error]:`, e?.message || e);
      }
    }

    // --- Strategy 3: YouTube Innertube API with robust recursive token search ---
    try {
      console.log(`[Innertube Extraction] Fetching playlist HTML page for ${playlistId}...`);
      const pageRes = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
        }
      });

      if (pageRes.ok) {
        const html = await pageRes.text();
        const ogTitle = html.match(/<meta property="og:title" content="(.*?)">/);
        if (ogTitle && ogTitle[1]) playlistTitle = ogTitle[1];

        const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || html.match(/"innertubeApiKey":"([^"]+)"/);
        const apiKey = apiKeyMatch ? apiKeyMatch[1] : '';

        let continuationToken: string | null = null;

        const processVideoNode = (v: any) => {
          if (!v || !v.videoId) return;
          let title = typeof v.title === 'string' ? v.title : (v.title?.runs?.[0]?.text || v.title?.simpleText || `فيديو ${v.videoId}`);
          let duration = v.lengthText?.simpleText || v.lengthText?.runs?.[0]?.text || 'N/A';
          let channelTitle = v.shortBylineText?.runs?.[0]?.text || 'قائمة تشغيل';
          addVideo({ id: v.videoId, title, duration, channelTitle });
        };

        const traverse = (obj: any): string | null => {
          if (!obj || typeof obj !== 'object') return null;
          let foundTok: string | null = null;

          if (obj.playlistVideoRenderer) processVideoNode(obj.playlistVideoRenderer);
          if (obj.gridVideoRenderer) processVideoNode(obj.gridVideoRenderer);

          if (obj.continuationItemRenderer) {
            const ep = obj.continuationItemRenderer.continuationEndpoint;
            const tok = ep?.continuationCommand?.token ||
                        ep?.playlistVideoListContinuationCommand?.token ||
                        ep?.commandExecutorCommand?.commands?.[0]?.continuationCommand?.token ||
                        obj.continuationItemRenderer.continuationCommand?.token;
            if (tok && typeof tok === 'string') foundTok = tok;
          }

          if (Array.isArray(obj)) {
            for (const item of obj) {
              const tok = traverse(item);
              if (tok) foundTok = tok;
            }
          } else {
            for (const k of Object.keys(obj)) {
              if (k === 'playlistVideoRenderer' || k === 'gridVideoRenderer') continue;
              const tok = traverse(obj[k]);
              if (tok) foundTok = tok;
            }
          }
          return foundTok;
        };

        const initialDataMatch = html.match(/var ytInitialData = ({[\s\S]*?});<\/script>/) ||
                                 html.match(/ytInitialData = ({[\s\S]*?});/);
        if (initialDataMatch) {
          try {
            const initialData = JSON.parse(initialDataMatch[1]);
            continuationToken = traverse(initialData);
          } catch (e) {
            console.warn('[ytInitialData parse fail]:', e);
          }
        }

        let pageCount = 0;
        while (continuationToken && pageCount < 100) {
          pageCount++;
          console.log(`[Innertube Browse] Page ${pageCount}, current videos: ${videos.length}...`);
          const browseUrl = apiKey ? `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}` : 'https://www.youtube.com/youtubei/v1/browse';
          const browseRes = await fetch(browseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
              'X-YouTube-Client-Name': '1',
              'X-YouTube-Client-Version': '2.20240101.00.00'
            },
            body: JSON.stringify({
              context: {
                client: {
                  clientName: 'WEB',
                  clientVersion: '2.20240101.00.00',
                  hl: 'ar',
                  gl: 'US'
                }
              },
              continuation: continuationToken
            })
          });

          if (!browseRes.ok) break;
          const browseData = await browseRes.json();
          const prevCount = videos.length;
          const nextTok = traverse(browseData);
          if (nextTok === continuationToken || (videos.length === prevCount && !nextTok)) {
            break;
          }
          continuationToken = nextTok;
        }
      }
    } catch (err) {
      console.warn('[Innertube fallback warning]:', err);
    }

    // --- Strategy 4: Fallback regex on HTML if all else returned 0 ---
    if (videos.length === 0) {
      try {
        const pageRes = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const videoIdMatches = html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g);
          for (const match of videoIdMatches) {
            addVideo({ id: match[1], title: `فيديو ${match[1]}` });
          }
        }
      } catch (e) {
        console.warn('[Regex fallback warning]:', e);
      }
    }

    console.log(`[Playlist Extraction Complete] Total videos fetched for playlist ${playlistId}: ${videos.length}`);
    return { playlistTitle, videos, total: videos.length };
  }

  // Get all videos for a playlist API
  app.get('/api/youtube/playlist-videos', async (req, res) => {
    try {
      const input = ((req.query.url as string) || (req.query.listId as string) || (req.query.q as string) || '').trim();
      const playlistId = extractPlaylistId(input);

      if (!playlistId) {
        return res.status(400).json({ error: 'Valid YouTube Playlist URL or ID is required' });
      }

      console.log(`[YouTube Playlist API] Extracting videos for Playlist ID: "${playlistId}"`);
      const result = await getPlaylistVideos(playlistId);
      return res.json(result);
    } catch (err: any) {
      console.error('[Playlist Videos Error]:', err);
      return res.status(500).json({ error: 'Failed to fetch playlist videos', details: err?.message });
    }
  });

  // Get playlists created by a channel API
  app.get('/api/youtube/channel-playlists', async (req, res) => {
    try {
      const inputUrl = ((req.query.url as string) || '').trim();
      const inputName = ((req.query.name as string) || (req.query.q as string) || '').trim();

      if (!inputUrl && !inputName) {
        return res.status(400).json({ error: 'Channel URL or name is required' });
      }

      console.log(`[Channel Playlists API] Finding playlists for: URL="${inputUrl}", Name="${inputName}"`);
      const { channelId, canonicalName, canonicalUrl } = await resolveChannelInfo(inputUrl, inputName);

      const playlists: any[] = [];
      const seenListIds = new Set<string>();

      // 1. Search yts for playlists by channel name
      try {
        const ytsRes = await yts(canonicalName);
        if (ytsRes && ytsRes.playlists) {
          for (const pl of ytsRes.playlists) {
            const listId = pl.listId || extractPlaylistId(pl.url);
            if (listId && !seenListIds.has(listId)) {
              seenListIds.add(listId);
              playlists.push({
                id: listId,
                title: pl.title,
                videoCount: pl.videoCount || 'N/A',
                url: pl.url || `https://www.youtube.com/playlist?list=${listId}`,
                thumbnail: pl.thumbnail || pl.image || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=300&q=80',
                channelTitle: pl.author?.name || canonicalName
              });
            }
          }
        }
      } catch (err) {
        console.warn('[Channel Playlists yts search error]:', err);
      }

      // 2. Scrape channel playlists page if channel ID is known
      if (channelId) {
        try {
          const playlistsPageUrl = `https://www.youtube.com/channel/${channelId}/playlists`;
          const pageRes = await fetch(playlistsPageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          if (pageRes.ok) {
            const html = await pageRes.text();
            const listMatches = html.matchAll(/"playlistId":"(PL[a-zA-Z0-9_-]+)"/g);
            for (const match of listMatches) {
              const listId = match[1];
              if (!seenListIds.has(listId)) {
                seenListIds.add(listId);
                playlists.push({
                  id: listId,
                  title: `قائمة تشغيل: ${listId}`,
                  videoCount: 'N/A',
                  url: `https://www.youtube.com/playlist?list=${listId}`,
                  thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=300&q=80',
                  channelTitle: canonicalName
                });
              }
            }
          }
        } catch (err) {
          console.warn('[Channel Playlists Scrape error]:', err);
        }
      }

      console.log(`[Channel Playlists API] Found ${playlists.length} playlists for "${canonicalName}"`);
      return res.json({ channelName: canonicalName, playlists, total: playlists.length });
    } catch (err: any) {
      console.error('[Channel Playlists Error]:', err);
      return res.status(500).json({ error: 'Failed to fetch channel playlists', details: err?.message });
    }
  });

  // Strict helper to verify if a video author matches the requested channel
  function isSameChannelAuthor(author: any, targetName: string, targetUrl: string, targetId: string | null): boolean {
    if (!author) return false;

    const authorName = (author.name || '').toLowerCase().trim();
    const authorUrl = (author.url || '').toLowerCase().trim();

    // 1. Channel ID match
    if (targetId && targetId.length > 5) {
      if (authorUrl.includes(targetId.toLowerCase()) || (author.id && String(author.id).includes(targetId))) {
        return true;
      }
    }

    // 2. URL overlap match
    if (targetUrl) {
      const cleanTargetUrl = targetUrl.toLowerCase().replace(/https?:\/\/(www\.)?youtube\.com\//, '').replace(/[@\/]/g, '').trim();
      const cleanAuthorUrl = authorUrl.replace(/https?:\/\/(www\.)?youtube\.com\//, '').replace(/[@\/]/g, '').trim();

      if (cleanTargetUrl && cleanAuthorUrl) {
        if (cleanAuthorUrl === cleanTargetUrl || cleanAuthorUrl.includes(cleanTargetUrl) || cleanTargetUrl.includes(cleanAuthorUrl)) {
          return true;
        }
      }
    }

    // 3. Name similarity match
    if (targetName) {
      const normalize = (str: string) =>
        str
          .toLowerCase()
          .replace(/قناة|channel|official|رسمية|رسمي|tv|اخبار|news/gi, '')
          .replace(/[\s_.-]/g, '')
          .trim();

      const normTarget = normalize(targetName);
      const normAuthor = normalize(authorName);

      if (normTarget && normAuthor) {
        if (normAuthor === normTarget || normAuthor.includes(normTarget) || normTarget.includes(normAuthor)) {
          return true;
        }
      }
    }

    return false;
  }

  // Get all videos for a specific channel (STRICT channel-only filtering)
  app.get('/api/youtube/channel-videos', async (req, res) => {
    try {
      const inputUrl = ((req.query.url as string) || '').trim();
      const inputName = ((req.query.name as string) || (req.query.q as string) || '').trim();

      if (!inputUrl && !inputName) {
        return res.status(400).json({ error: 'Channel URL or name is required' });
      }

      console.log(`[YouTube Channel Videos API] Request for URL: "${inputUrl}", Name: "${inputName}"`);

      // Resolve official channel information
      const { channelId, canonicalName, canonicalUrl } = await resolveChannelInfo(inputUrl, inputName);
      console.log(`[Channel Resolved] ID: ${channelId}, Name: "${canonicalName}", URL: ${canonicalUrl}`);

      const seenVideoIds = new Set<string>();
      const videos: any[] = [];

      // A channel's uploads playlist contains its full upload history. It is
      // substantially more complete than the public RSS feed, which only has
      // recent entries.
      if (channelId?.startsWith('UC')) {
        try {
          const uploadsPlaylistId = `UU${channelId.substring(2)}`;
          const uploads = await getPlaylistVideos(uploadsPlaylistId);

          if (uploads.videos.length > 0) {
            const channelVideos = uploads.videos.map((video) => ({
              ...video,
              channelTitle: canonicalName,
              channelUrl: canonicalUrl
            }));

            console.log(`[YouTube Channel Videos API] Extracted ${channelVideos.length} upload videos for "${canonicalName}"`);
            return res.json({
              channelName: canonicalName,
              videos: channelVideos,
              total: channelVideos.length
            });
          }
        } catch (uploadsError) {
          console.warn('[Uploads playlist extraction error]:', uploadsError);
        }
      }

      // Pass 1: Official RSS feed if channel ID is known (Guaranteed 100% channel-only videos)
      if (channelId) {
        try {
          const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
          const rssRes = await fetch(rssUrl);
          if (rssRes.ok) {
            const xmlText = await rssRes.text();
            const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
            let match;
            while ((match = entryRegex.exec(xmlText)) !== null) {
              const entry = match[1];
              const videoIdMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
              const titleMatch = entry.match(/<title>(.*?)<\/title>/);
              const authorMatch = entry.match(/<name>(.*?)<\/name>/);
              const publishedMatch = entry.match(/<published>(.*?)<\/published>/);

              if (videoIdMatch) {
                const vidId = videoIdMatch[1];
                if (!seenVideoIds.has(vidId)) {
                  seenVideoIds.add(vidId);
                  const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') : 'فيديو القناة';
                  videos.push({
                    id: vidId,
                    title,
                    duration: 'N/A',
                    url: `https://www.youtube.com/watch?v=${vidId}`,
                    thumbnail: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
                    thumbnailAlt: title,
                    selected: true,
                    channelTitle: authorMatch ? authorMatch[1] : canonicalName,
                    channelUrl: canonicalUrl,
                    views: '',
                    publishedAt: publishedMatch ? publishedMatch[1].split('T')[0] : ''
                  });
                }
              }
            }
          }
        } catch (rssErr) {
          console.warn('[RSS Feed Fetch Error]:', rssErr);
        }
      }

      // Pass 1b: Uploads playlist RSS feed if channel ID is known
      if (channelId && channelId.startsWith('UC')) {
        try {
          const uploadsPlaylistId = `UU${channelId.substring(2)}`;
          const rssUrl2 = `https://www.youtube.com/feeds/videos.xml?playlist_id=${uploadsPlaylistId}`;
          const rssRes2 = await fetch(rssUrl2);
          if (rssRes2.ok) {
            const xmlText2 = await rssRes2.text();
            const entryRegex2 = /<entry>([\s\S]*?)<\/entry>/g;
            let match2;
            while ((match2 = entryRegex2.exec(xmlText2)) !== null) {
              const entry = match2[1];
              const videoIdMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
              const titleMatch = entry.match(/<title>(.*?)<\/title>/);
              const authorMatch = entry.match(/<name>(.*?)<\/name>/);
              const publishedMatch = entry.match(/<published>(.*?)<\/published>/);

              if (videoIdMatch) {
                const vidId = videoIdMatch[1];
                if (!seenVideoIds.has(vidId)) {
                  seenVideoIds.add(vidId);
                  const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') : 'فيديو القناة';
                  videos.push({
                    id: vidId,
                    title,
                    duration: 'N/A',
                    url: `https://www.youtube.com/watch?v=${vidId}`,
                    thumbnail: `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`,
                    thumbnailAlt: title,
                    selected: true,
                    channelTitle: authorMatch ? authorMatch[1] : canonicalName,
                    channelUrl: canonicalUrl,
                    views: '',
                    publishedAt: publishedMatch ? publishedMatch[1].split('T')[0] : ''
                  });
                }
              }
            }
          }
        } catch (e) {
          console.warn('[Uploads RSS Feed Fetch Error]:', e);
        }
      }

      // Pass 2: yts search queries with STRICT author verification
      const searchTerms = [
        `"${canonicalName}"`,
        canonicalName,
        canonicalUrl.replace('https://www.youtube.com/', ''),
        `site:youtube.com "${canonicalName}"`,
        `"${canonicalName}" 1`,
        `"${canonicalName}" 2`,
        `"${canonicalName}" 3`,
        `"${canonicalName}" 4`,
        `"${canonicalName}" 5`,
        `"${canonicalName}" 6`,
        `"${canonicalName}" 7`,
        `"${canonicalName}" 8`,
        `"${canonicalName}" 9`,
        `"${canonicalName}" 10`,
        `"${canonicalName}" الحلقة`,
        `"${canonicalName}" جزء`,
        `"${canonicalName}" درس`,
        `"${canonicalName}" محاضرة`,
        `"${canonicalName}" 2025`,
        `"${canonicalName}" 2024`,
        `"${canonicalName}" 2023`,
        `"${canonicalName}" 2022`,
        `"${canonicalName}" 2021`,
        `"${canonicalName}" كامل`,
        `"${canonicalName}" جديد`,
        `"${canonicalName}" فيديو`,
        `"${canonicalName}" مقطع`,
        `"${canonicalName}" بث`
      ];

      const searchPromises = searchTerms.map((term) =>
        yts(term).catch((err) => {
          console.warn(`yts search failed for term "${term}":`, err?.message);
          return null;
        })
      );

      const results = await Promise.all(searchPromises);

      for (const resObj of results) {
        if (!resObj || !resObj.videos) continue;
        for (const v of resObj.videos) {
          const id = v.videoId || v.url;
          if (!id || seenVideoIds.has(id)) continue;

          // STRICT FILTER: Verify that the video's author matches the channel!
          if (isSameChannelAuthor(v.author, canonicalName, canonicalUrl, channelId)) {
            seenVideoIds.add(id);
            videos.push({
              id,
              title: v.title,
              duration: v.timestamp || (v.duration ? `${v.duration.seconds}s` : 'N/A'),
              url: v.url,
              thumbnail: v.thumbnail || v.image,
              thumbnailAlt: v.title,
              selected: true,
              channelTitle: v.author?.name || canonicalName,
              channelUrl: v.author?.url || canonicalUrl,
              views: v.views ? `${v.views.toLocaleString()} views` : '',
              publishedAt: v.ago || ''
            });
          }
        }
      }

      console.log(`[YouTube Channel Videos API] Extracted ${videos.length} STRICT channel videos for "${canonicalName}"`);
      return res.json({ channelName: canonicalName, videos, total: videos.length });
    } catch (err: any) {
      console.error('[Channel Videos Error]:', err);
      return res.status(500).json({ error: 'Failed to fetch channel videos', details: err?.message || String(err) });
    }
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    import('vite').then(({ createServer: createViteServer }) => {
      createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
      }).then((vite) => {
        app.use(vite.middlewares);
      });
    });
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`CoreOps / YT-Linker Server listening on http://0.0.0.0:${PORT}`);
    });
  }

export default app;
