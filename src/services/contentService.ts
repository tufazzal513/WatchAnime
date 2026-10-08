import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../config/firebase';
import {
  ContentItem,
  Episode,
  ContentRequest,
  VideoReport,
  SiteSettings,
  ContentType,
} from '../types';

export const INITIAL_SEED_CONTENT: ContentItem[] = [
  {
    id: 'solo-leveling',
    title: 'Solo Leveling',
    originalTitle: 'Na Honjaman Rebeleop',
    slug: 'solo-leveling',
    type: 'anime',
    description: 'When sudden gates appear connecting our world to another dimension filled with monsters, ordinary humans awaken magical powers. Sung Jinwoo, notoriously known as the "Weakest Hunter of All Mankind", faces a deadly double dungeon and unlocks a mysterious Quest log only he can see.',
    posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    backdropUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1600&auto=format&fit=crop&q=80',
    releaseYear: 2024,
    genres: ['Action', 'Fantasy', 'Adventure', 'Supernatural'],
    rating: 8.9,
    voteCount: 14200,
    runtime: '24m',
    country: 'Japan',
    audioLanguage: 'Japanese, English',
    subtitles: ['English', 'Bengali', 'Spanish'],
    status: 'published',
    featured: true,
    trending: true,
    totalSeasons: 1,
    totalEpisodes: 12,
    cast: ['Taito Ban', 'Genta Nakamura', 'Reina Ueda'],
    director: 'Shunsuke Nakashige',
  },
  {
    id: 'jujutsu-kaisen',
    title: 'Jujutsu Kaisen',
    originalTitle: 'Jujutsu Kaisen',
    slug: 'jujutsu-kaisen',
    type: 'anime',
    description: 'A boy swallows a cursed talisman - the finger of a demon - and becomes cursed himself. He enters a shaman school to be able to locate the demon other body parts and thus exorcise himself.',
    posterUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80',
    backdropUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1600&auto=format&fit=crop&q=80',
    releaseYear: 2023,
    genres: ['Action', 'Dark Fantasy', 'Supernatural', 'Shounen'],
    rating: 8.7,
    voteCount: 28400,
    runtime: '24m',
    country: 'Japan',
    audioLanguage: 'Japanese, English',
    subtitles: ['English', 'Bengali'],
    status: 'published',
    featured: true,
    trending: true,
    totalSeasons: 2,
    totalEpisodes: 47,
    cast: ['Junya Enoki', 'Yuma Uchida', 'Asami Seto', 'Yuichi Nakamura'],
    director: 'Sunghoo Park',
  },
  {
    id: 'attack-on-titan',
    title: 'Attack on Titan',
    originalTitle: 'Shingeki no Kyojin',
    slug: 'attack-on-titan',
    type: 'anime',
    description: 'After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans that have brought humanity to the brink of extinction.',
    posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    backdropUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600&auto=format&fit=crop&q=80',
    releaseYear: 2023,
    genres: ['Action', 'Dark Fantasy', 'Mystery', 'Post-Apocalyptic'],
    rating: 9.1,
    voteCount: 54900,
    runtime: '24m',
    country: 'Japan',
    audioLanguage: 'Japanese, English',
    subtitles: ['English', 'Bengali'],
    status: 'published',
    featured: true,
    trending: true,
    totalSeasons: 4,
    totalEpisodes: 89,
    cast: ['Yuki Kaji', 'Yui Ishikawa', 'Marina Inoue', 'Hiroshi Kamiya'],
    director: 'Tetsuro Araki',
  },
  {
    id: 'demon-slayer',
    title: 'Demon Slayer: Kimetsu no Yaiba',
    originalTitle: 'Kimetsu no Yaiba',
    slug: 'demon-slayer',
    type: 'anime',
    description: 'A youth begins a quest to fight demons and save his sister after his family is slaughtered and the sister turned into a demon with humanity intact.',
    posterUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80',
    backdropUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=1600&auto=format&fit=crop&q=80',
    releaseYear: 2024,
    genres: ['Action', 'Fantasy', 'Historical', 'Shounen'],
    rating: 8.8,
    voteCount: 39100,
    runtime: '24m',
    country: 'Japan',
    audioLanguage: 'Japanese, English',
    subtitles: ['English', 'Bengali'],
    status: 'published',
    featured: false,
    trending: true,
    totalSeasons: 4,
    totalEpisodes: 55,
    cast: ['Natsuki Hanae', 'Akari Kito', 'Hiro Shimono', 'Yoshitsugu Matsuoka'],
    director: 'Haruo Sotozaki',
  },
  {
    id: 'your-name',
    title: 'Your Name.',
    originalTitle: 'Kimi no Na wa',
    slug: 'your-name',
    type: 'movie',
    description: 'Two teenagers share a profound, magical connection upon discovering they are swapping bodies. Things manage to become even more complicated when the boy and girl decide to meet in person.',
    posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    backdropUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80',
    releaseYear: 2016,
    genres: ['Romance', 'Drama', 'Fantasy', 'Supernatural'],
    rating: 8.9,
    voteCount: 42000,
    runtime: '1h 52m',
    country: 'Japan',
    audioLanguage: 'Japanese, English',
    subtitles: ['English', 'Bengali'],
    status: 'published',
    featured: false,
    trending: true,
    videoServers: [
      {
        id: 'srv-1',
        serverName: 'Server 1 (HD)',
        embedUrl: 'https://www.youtube-nocookie.com/embed/s0wTdCQoc2k',
        quality: '1080p',
        subDub: 'Sub',
        isDefault: true,
      },
      {
        id: 'srv-2',
        serverName: 'Server 2 (Backup)',
        embedUrl: 'https://www.youtube-nocookie.com/embed/k4xGqY5IDBE',
        quality: '720p',
        subDub: 'Dub',
      },
    ],
    cast: ['Ryunosuke Kamiki', 'Mone Kamishiraishi'],
    director: 'Makoto Shinkai',
  },
  {
    id: 'suzume',
    title: 'Suzume',
    originalTitle: 'Suzume no Tojimari',
    slug: 'suzume',
    type: 'movie',
    description: 'A modern action adventure road story where a 17-year-old girl named Suzume helps a mysterious young man close doors from the other side that are releasing disasters all over Japan.',
    posterUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    backdropUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600&auto=format&fit=crop&q=80',
    releaseYear: 2022,
    genres: ['Adventure', 'Fantasy', 'Drama'],
    rating: 8.4,
    voteCount: 15300,
    runtime: '2h 2m',
    country: 'Japan',
    audioLanguage: 'Japanese, English',
    subtitles: ['English', 'Bengali'],
    status: 'published',
    featured: false,
    trending: false,
    videoServers: [
      {
        id: 'srv-1',
        serverName: 'Server 1 (HD)',
        embedUrl: 'https://www.youtube-nocookie.com/embed/6c-g8oJ8j3g',
        quality: '1080p',
        subDub: 'Sub',
        isDefault: true,
      },
    ],
    cast: ['Nanoka Hara', 'Hokuto Matsumura'],
    director: 'Makoto Shinkai',
  },
  {
    id: 'stranger-things',
    title: 'Stranger Things',
    originalTitle: 'Stranger Things',
    slug: 'stranger-things',
    type: 'series',
    description: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.',
    posterUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600&auto=format&fit=crop&q=80',
    backdropUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1600&auto=format&fit=crop&q=80',
    releaseYear: 2022,
    genres: ['Sci-Fi', 'Horror', 'Drama', 'Mystery'],
    rating: 8.7,
    voteCount: 68000,
    runtime: '50m',
    country: 'USA',
    audioLanguage: 'English',
    subtitles: ['English', 'Bengali'],
    status: 'published',
    featured: false,
    trending: true,
    totalSeasons: 4,
    totalEpisodes: 34,
    cast: ['Millie Bobby Brown', 'Finn Wolfhard', 'David Harbour', 'Winona Ryder'],
    director: 'The Duffer Brothers',
  },
];

export const INITIAL_SEED_EPISODES: Record<string, Episode[]> = {
  'solo-leveling': [
    {
      id: 'sl-ep-1',
      contentId: 'solo-leveling',
      seasonNumber: 1,
      episodeNumber: 1,
      title: "Episode 1: I'm Used to It",
      description: 'Ten years ago, the Gates opened connecting this world with magic monsters. Hunters risk life and limb to clear dungeons. Sung Jinwoo is the weakest of them.',
      thumbnail: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80',
      duration: '24m',
      videoServers: [
        {
          id: 'srv-1',
          serverName: 'Server 1 (HD)',
          embedUrl: 'https://www.youtube-nocookie.com/embed/9oH47r8Q-0U',
          quality: '1080p',
          subDub: 'Sub',
          isDefault: true,
        },
        {
          id: 'srv-2',
          serverName: 'Server 2 (Backup)',
          embedUrl: 'https://www.youtube-nocookie.com/embed/5a6qJ3X8Pyo',
          quality: '720p',
          subDub: 'Dub',
        },
      ],
    },
    {
      id: 'sl-ep-2',
      contentId: 'solo-leveling',
      seasonNumber: 1,
      episodeNumber: 2,
      title: 'Episode 2: If I Had One More Chance',
      description: 'Trapped inside the Cartenon Temple, the raiding party faces the terrifying God Statue rules of worship and sacrifice.',
      thumbnail: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=400&auto=format&fit=crop&q=80',
      duration: '24m',
      videoServers: [
        {
          id: 'srv-1',
          serverName: 'Server 1 (HD)',
          embedUrl: 'https://www.youtube-nocookie.com/embed/3c9w2m0L6wQ',
          quality: '1080p',
          subDub: 'Sub',
          isDefault: true,
        },
      ],
    },
    {
      id: 'sl-ep-3',
      contentId: 'solo-leveling',
      seasonNumber: 1,
      episodeNumber: 3,
      title: 'Episode 3: It’s Like a Game',
      description: 'Jinwoo awakens in the hospital alive, finding a floating holographic screen that only he can see with Daily Quests.',
      thumbnail: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&auto=format&fit=crop&q=80',
      duration: '24m',
      videoServers: [
        {
          id: 'srv-1',
          serverName: 'Server 1 (HD)',
          embedUrl: 'https://www.youtube-nocookie.com/embed/9oH47r8Q-0U',
          quality: '1080p',
          subDub: 'Sub',
          isDefault: true,
        },
      ],
    },
  ],
  'jujutsu-kaisen': [
    {
      id: 'jjk-ep-1',
      contentId: 'jujutsu-kaisen',
      seasonNumber: 1,
      episodeNumber: 1,
      title: 'Episode 1: Ryomen Sukuna',
      description: 'Yuji Itadori is a high school student with tremendous physical abilities. When his friends open a cursed talisman at school, evil curses emerge.',
      thumbnail: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&auto=format&fit=crop&q=80',
      duration: '24m',
      videoServers: [
        {
          id: 'srv-1',
          serverName: 'Server 1 (HD)',
          embedUrl: 'https://www.youtube-nocookie.com/embed/4A_X-C7EpxQ',
          quality: '1080p',
          subDub: 'Sub',
          isDefault: true,
        },
      ],
    },
  ],
  'attack-on-titan': [
    {
      id: 'aot-ep-1',
      contentId: 'attack-on-titan',
      seasonNumber: 1,
      episodeNumber: 1,
      title: 'Episode 1: To You, in 2000 Years: The Fall of Shiganshina',
      description: 'A 60-meter Colossal Titan breaches the outer wall of the district, and the quiet life Eren Jaeger once knew is destroyed forever.',
      thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80',
      duration: '24m',
      videoServers: [
        {
          id: 'srv-1',
          serverName: 'Server 1 (HD)',
          embedUrl: 'https://www.youtube-nocookie.com/embed/MGRm4IzK1SQ',
          quality: '1080p',
          subDub: 'Sub',
          isDefault: true,
        },
      ],
    },
  ],
};

// Helper to strip any undefined values before sending to Firestore
function cleanObject<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = cleanObject(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

// Fetch all published content
export async function getAllContent(): Promise<ContentItem[]> {
  const contentPath = 'content';
  try {
    const snap = await getDocs(collection(db, contentPath));
    const items: ContentItem[] = [];
    snap.forEach((docSnap) => {
      items.push(docSnap.data() as ContentItem);
    });

    if (items.length === 0) {
      // Fallback to initial seed items
      return INITIAL_SEED_CONTENT;
    }
    return items;
  } catch {
    // If database is empty or not yet seeded, return rich seed items
    return INITIAL_SEED_CONTENT;
  }
}

// Fetch single content item
export async function getContentById(id: string): Promise<ContentItem | null> {
  const docPath = `content/${id}`;
  try {
    const docSnap = await getDoc(doc(db, 'content', id));
    if (docSnap.exists()) {
      return docSnap.data() as ContentItem;
    }
  } catch (err) {
    console.warn(`Could not fetch doc from Firestore, checking fallback: ${err}`);
  }
  const fallback = INITIAL_SEED_CONTENT.find((item) => item.id === id);
  return fallback || null;
}

// Fetch episodes for a series or anime
export async function getEpisodes(contentId: string): Promise<Episode[]> {
  const episodesPath = `content/${contentId}/episodes`;
  try {
    const snap = await getDocs(collection(db, 'content', contentId, 'episodes'));
    const eps: Episode[] = [];
    snap.forEach((docSnap) => {
      eps.push(docSnap.data() as Episode);
    });
    if (eps.length > 0) {
      eps.sort((a, b) => a.episodeNumber - b.episodeNumber);
      return eps;
    }
  } catch (err) {
    console.warn(`Could not fetch episodes from Firestore: ${err}`);
  }
  const seedEps = INITIAL_SEED_EPISODES[contentId] || [];
  return seedEps;
}

// Save or Update content item (Admin)
export async function saveContent(content: ContentItem): Promise<void> {
  const path = `content/${content.id}`;
  try {
    await setDoc(doc(db, 'content', content.id), cleanObject({
      ...content,
      updatedAt: new Date().toISOString(),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Delete content item (Admin)
export async function deleteContent(id: string): Promise<void> {
  const path = `content/${id}`;
  try {
    await deleteDoc(doc(db, 'content', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Save or Update episode (Admin)
export async function saveEpisode(episode: Episode): Promise<void> {
  const path = `content/${episode.contentId}/episodes/${episode.id}`;
  try {
    await setDoc(doc(db, 'content', episode.contentId, 'episodes', episode.id), cleanObject({
      ...episode,
      createdAt: episode.createdAt || new Date().toISOString(),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Delete episode (Admin)
export async function deleteEpisode(contentId: string, episodeId: string): Promise<void> {
  const path = `content/${contentId}/episodes/${episodeId}`;
  try {
    await deleteDoc(doc(db, 'content', contentId, 'episodes', episodeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Seed Database from Admin panel
export async function seedCatalogToFirestore(): Promise<number> {
  let count = 0;
  for (const item of INITIAL_SEED_CONTENT) {
    await setDoc(doc(db, 'content', item.id), cleanObject(item));
    count++;
    const eps = INITIAL_SEED_EPISODES[item.id];
    if (eps) {
      for (const ep of eps) {
        await setDoc(doc(db, 'content', item.id, 'episodes', ep.id), cleanObject(ep));
      }
    }
  }
  return count;
}

// Submit Content Request
export async function submitContentRequest(req: Omit<ContentRequest, 'id' | 'createdAt' | 'status'>): Promise<string> {
  const reqId = `req-${Date.now()}`;
  const fullReq: ContentRequest = {
    ...req,
    id: reqId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  const path = `contentRequests/${reqId}`;
  try {
    await setDoc(doc(db, 'contentRequests', reqId), cleanObject(fullReq));
    return reqId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

// Submit Broken Video Report
export async function submitVideoReport(report: Omit<VideoReport, 'id' | 'createdAt' | 'status'>): Promise<string> {
  const repId = `rep-${Date.now()}`;
  const fullRep: VideoReport = {
    ...report,
    id: repId,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  const path = `videoReports/${repId}`;
  try {
    await setDoc(doc(db, 'videoReports', repId), cleanObject(fullRep));
    return repId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

// Fetch all requests (Admin)
export async function getAllRequests(): Promise<ContentRequest[]> {
  const path = 'contentRequests';
  try {
    const snap = await getDocs(collection(db, path));
    const items: ContentRequest[] = [];
    snap.forEach((d) => items.push(d.data() as ContentRequest));
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

// Update request status (Admin)
export async function updateRequestStatus(reqId: string, status: ContentRequest['status']): Promise<void> {
  const path = `contentRequests/${reqId}`;
  try {
    await updateDoc(doc(db, 'contentRequests', reqId), { status });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// Fetch all video reports (Admin)
export async function getAllReports(): Promise<VideoReport[]> {
  const path = 'videoReports';
  try {
    const snap = await getDocs(collection(db, path));
    const items: VideoReport[] = [];
    snap.forEach((d) => items.push(d.data() as VideoReport));
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

// Update video report status (Admin)
export async function updateReportStatus(repId: string, status: VideoReport['status']): Promise<void> {
  const path = `videoReports/${repId}`;
  try {
    await updateDoc(doc(db, 'videoReports', repId), { status });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// Fetch Site Settings
export async function getSiteSettings(): Promise<SiteSettings> {
  const path = 'siteSettings/general';
  try {
    const snap = await getDoc(doc(db, 'siteSettings', 'general'));
    if (snap.exists()) {
      return snap.data() as SiteSettings;
    }
  } catch {
    // Default settings
  }
  return {
    siteName: 'WatchAnime',
    defaultLanguage: 'en',
    announcement: 'Welcome to WatchAnime - Stream anime, movies & series in HD!',
    adsEnabled: false,
    bannerAdTop: '',
    bannerAdBottom: '',
    allowedEmbedHosts: ['youtube.com', 'youtube-nocookie.com', 'streamtape.com', 'vidstream.pro', 'dailymotion.com'],
  };
}

// Save Site Settings (Admin)
export async function saveSiteSettings(settings: SiteSettings): Promise<void> {
  const path = 'siteSettings/general';
  try {
    await setDoc(doc(db, 'siteSettings', 'general'), cleanObject(settings));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
