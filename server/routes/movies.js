import express from 'express';
import { protect } from '../middleware/auth.js';

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
    return {
      ...shape(data),
      providers: shapeProviders(data.watch_providers?.results),
      videos: shapeVideos(videos.results),
    };
  })
);

export default router;
