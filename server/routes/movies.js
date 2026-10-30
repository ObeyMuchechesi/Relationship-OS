import express from 'express';
import { protect } from '../middleware/auth.js';
import { MovieSource } from '../models/index.js';

// TMDB catalog proxy. The API key/token lives only on the server — the client
// asks us, we ask TMDB, and we shape the response (including full image URLs).
// Users never talk to TMDB directly and none of their activity leaves this app.
const router = express.Router();

router.use(protect);

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

const tmdb = async (path, params = {}) => {
  const token = process.env.TMDB_READ_TOKEN;
  const key = process.env.TMDB_API_KEY;
  if (!token && !key) {
    const err = new Error('Movie catalog is not configured yet');
    err.status = 503;
    throw err;
  }

  const url = new URL(BASE + path);
  url.searchParams.set('language', 'en-US');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  else url.searchParams.set('api_key', key);

  const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!r.ok) {
    const err = new Error(`Catalog unavailable (${r.status})`);
    err.status = 502;
    throw err;
  }
  return r.json();
};

const shape = (m) => ({
  id: m.id,
  title: m.title || m.name || '',
  year: (m.release_date || m.first_air_date || '').slice(0, 4),
  rating: m.vote_average ? Math.round(m.vote_average * 10) / 10 : 0,
  overview: m.overview || '',
  runtime: m.runtime || 0,
  poster: m.poster_path ? `${IMG}/w500${m.poster_path}` : '',
  backdrop: m.backdrop_path ? `${IMG}/w780${m.backdrop_path}` : '',
});

// Official YouTube videos TMDB attaches to a title (trailers, teasers,
// clips). Ranked so the best official trailer comes first — this is what
// plays in the shared player when a movie is picked.
const videoRank = (v) => {
  const t = (v.type || '').toLowerCase();
  if (t === 'trailer') return v.official ? 0 : 1;
  if (t === 'teaser') return 2;
  if (t === 'clip') return 3;
  return 4;
};

const shapeVideos = (results = []) =>
  results
    .filter((v) => v.site === 'YouTube' && v.key)
    .sort((a, b) => videoRank(a) - videoRank(b))
    .slice(0, 8)
    .map((v) => ({
      key: v.key,
      name: v.name || '',
      type: v.type || '',
      official: Boolean(v.official),
    }));

// Where to watch legally: TMDB's JustWatch-backed provider list per region.
const shapeProviders = (results = {}) => {
  const region = results.ZW || results.US || Object.values(results)[0];
  if (!region) return { link: '', options: [] };
  const buckets = [
    ['free', 'Free'],
    ['flatrate', 'Included'],
    ['ads', 'Free with ads'],
    ['rent', 'Rent'],
    ['buy', 'Buy'],
  ];
  const options = [];
  for (const [key, label] of buckets) {
    for (const p of region[key] || []) {
      options.push({
        label,
        name: p.provider_name,
        logo: p.logo_path ? `${IMG}/w92${p.logo_path}` : '',
      });
    }
  }
  return { link: region.link || '', options };
};

// ---------------------------------------------------------------------------
// Full-movie resolution: find a *legal* full-length copy that can play inside
// our synced player. Two sources, in order:
//
//  1. archive.org public-domain feature films (licenseurl filtered) — played
//     straight from the direct file URL in our own <video> sync engine.
//  2. YouTube's free/ad-supported catalog, found via the Data API (needs
//     YOUTUBE_API_KEY) — verified embeddable + syndicated + duration-matched,
//     played in the same YouTube player the trailers use.
//
// Results (including misses) are cached per TMDB id: YouTube allows only 100
// searches/day, and archive.org should not be hammered.
// ---------------------------------------------------------------------------

const http = (url, timeout = 8000) =>
  fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: { 'User-Agent': 'RelationshipOS-movie-picker/1.0' },
  });

const json = async (url) => {
  const r = await http(url);
  if (!r.ok) throw new Error(`lookup failed (${r.status})`);
  return r.json();
};

const isoToSec = (s = '') => {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(s).trim());
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
};

const lenToSec = (v) => {
  if (typeof v === 'number') return v;
  const s = String(v || '');
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const p = s.split(':').map(Number);
  if (p.length === 3 && p.every(Number.isFinite)) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2 && p.every(Number.isFinite)) return p[0] * 60 + p[1];
  return 0;
};

// A found file must actually be feature-length and match the known runtime.
const isFeatureLength = (secs, runtime) => {
  if (!secs) return false;
  if (runtime && runtime > 0) {
    const want = runtime * 60;
    return Math.abs(secs - want) <= Math.max(90, want * 0.08);
  }
  return secs >= 54 * 60 && secs <= 4 * 3600;
};

const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
const titlesMatch = (a, b) => {
  const wa = words(a);
  const wb = new Set(words(b));
  if (!wa.length || !wb.size) return false;
  const hit = wa.filter((w) => wb.has(w)).length;
  return hit / wa.length >= 0.6;
};

// 1) archive.org — public-domain feature films with a direct file we can play.
async function resolveArchive({ title, year, runtime }) {
  const q = [
    `title:"${String(title).replace(/"/g, '')}"`,
    year ? `year:[${year - 1} TO ${year + 1}]` : '',
    'mediatype:movies',
    'collection:feature_films',
    // Uploader-declared public domain; paired with the runtime match below.
    'licenseurl:*publicdomain*',
  ]
    .filter(Boolean)
    .join(' AND ');
  const u =
    'https://archive.org/advancedsearch.php?q=' +
    encodeURIComponent(q) +
    '&rows=6&output=json&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year';
  const res = await json(u);
  const docs = res?.response?.docs || [];

  // Rank: exact title first, and skip derivative/preview items outright.
  const junk = /\b(ipod|flash|sample|trailer|preview|teaser|clip|edit|sample)\b/i;
  const ranked = [...docs].sort((a, b) => {
    const exact = (d) => (String(d.title || '').trim().toLowerCase() === String(title).trim().toLowerCase() ? 0 : 1);
    return exact(a) - exact(b) || (junk.test(a.title) ? 1 : 0) - (junk.test(b.title) ? 1 : 0);
  });

  for (const doc of ranked.slice(0, 4)) {
    if (junk.test(String(doc.title || ''))) continue;
    if (!titlesMatch(title, doc.title)) continue;
    const meta = await json(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`);
    const files = (meta.files || [])
      .filter((f) => ((f.format || '').startsWith('MPEG4') || /\.mp4$/i.test(f.name || '')) && isFeatureLength(lenToSec(f.length), runtime))
      // Prefer the highest-resolution copy of the film.
      .sort((a, b) => (Number(b.height) || 0) - (Number(a.height) || 0));
    const f = files[0];
    if (f) {
      return {
        source: 'archive',
        url: `https://archive.org/download/${doc.identifier}/${encodeURI(f.name)}`,
        title: String(doc.title || title),
      };
    }
  }
  return null;
}

// 2) YouTube — only with an API key; embeddable + syndicated + runtime match.
async function resolveYoutube({ title, year, runtime }) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  const base = 'https://www.googleapis.com/youtube/v3/';

  const search = await json(
    `${base}search?part=snippet&type=video&maxResults=8&videoEmbeddable=true&videoSyndicated=true&videoDuration=long&q=${encodeURIComponent(
      `${title} ${year || ''} full movie`
    )}&key=${key}`
  );
  const ids = (search.items || []).map((i) => i.id?.videoId).filter(Boolean);
  if (!ids.length) return null;

  const details = await json(
    `${base}videos?part=snippet,contentDetails,status&id=${ids.join(',')}&key=${key}`
  );
  for (const v of details.items || []) {
    const st = v.status || {};
    const cd = v.contentDetails || {};
    if (st.embeddable !== true || st.privacyStatus !== 'public') continue;
    if (st.uploadStatus && st.uploadStatus !== 'processed') continue;
    if (!cd.licensedContent) continue; // channel linked to a content partner
    if (!isFeatureLength(isoToSec(cd.duration), runtime)) continue;
    if (!titlesMatch(title, v.snippet?.title)) continue;
    return { source: 'youtube', key: v.id, title: String(v.snippet.title || title) };
  }
  return null;
}

// Cached orchestration: hit → immediate, miss → recheck after 7 days.
async function resolveFullMovie(info) {
  try {
    const cached = await MovieSource.findOne({ tmdbId: info.tmdbId });
    const fresh = cached && Date.now() - new Date(cached.checkedAt).getTime() < 7 * 86400000;
    if (cached && fresh) {
      if (cached.source === 'none') return null;
      return { source: cached.source, key: cached.key, url: cached.url, title: cached.title };
    }

    const found =
      (await resolveArchive(info).catch(() => null)) ||
      (await resolveYoutube(info).catch(() => null));

    await MovieSource.findOneAndUpdate(
      { tmdbId: info.tmdbId },
      {
        tmdbId: info.tmdbId,
        source: found ? found.source : 'none',
        key: found?.key || '',
        url: found?.url || '',
        title: found?.title || '',
        checkedAt: new Date(),
      },
      { upsert: true }
    );
    return found;
  } catch {
    return null; // lookups are best-effort — the trailer path still works
  }
}

const guard = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// GET /api/movies/popular?page=1 — the browse feed.
router.get(
  '/popular',
  guard(async (req) => {
    const page = Math.min(500, Math.max(1, Number(req.query.page) || 1));
    const data = await tmdb('/movie/popular', { page });
    return { page: data.page, totalPages: data.total_pages, movies: (data.results || []).map(shape) };
  })
);

// GET /api/movies/search?q=inception
router.get(
  '/search',
  guard(async (req) => {
    const q = String(req.query.q || '').trim();
    if (!q) return { movies: [] };
    const page = Math.min(500, Math.max(1, Number(req.query.page) || 1));
    const data = await tmdb('/search/movie', { query: q, page, include_adult: 'false' });
    return { page: data.page, totalPages: data.total_pages, movies: (data.results || []).map(shape) };
  })
);

// GET /api/movies/:id — details plus where to watch, for the picked movie.
router.get(
  '/:id',
  guard(async (req) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      const err = new Error('Bad movie id');
      err.status = 400;
      throw err;
    }
    const [data, videos] = await Promise.all([
      tmdb(`/movie/${id}`, { append_to_response: 'watch/providers' }),
      tmdb(`/movie/${id}/videos`).catch(() => ({ results: [] })),
    ]);
    const shaped = shape(data);
    const fullMovie = await resolveFullMovie({
      tmdbId: id,
      title: shaped.title,
      year: Number(shaped.year) || 0,
      runtime: shaped.runtime,
    });
    return {
      ...shaped,
      providers: shapeProviders(data.watch_providers?.results),
      videos: shapeVideos(videos.results),
      fullMovie,
    };
  })
);

export default router;
