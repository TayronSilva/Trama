export const CHANNELS = [
  {
    id: 'instagram',
    name: 'Instagram',
    short: 'ig',
    color: '#c13584',
    limit: 2200,
    previewLabel: 'Legenda do feed',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    short: 'in',
    color: '#0a66c2',
    limit: 3000,
    previewLabel: 'Publicação',
  },
  {
    id: 'x',
    name: 'X',
    short: 'x',
    color: '#171717',
    limit: 280,
    previewLabel: 'Post',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    short: 'tt',
    color: '#13b8a6',
    limit: 2200,
    previewLabel: 'Legenda do vídeo',
  },
];

export const DEFAULT_HANDLES = {
  instagram: '@trama.studio',
  linkedin: 'trama-studio',
  x: '@trama',
  tiktok: '@trama.studio',
};

const CHANNELS_BY_ID = new Map(CHANNELS.map((channel) => [channel.id, channel]));

export function channelById(id) {
  return (
    CHANNELS_BY_ID.get(id) ?? {
      id,
      name: id,
      short: id,
      color: '#777',
      limit: 2200,
      previewLabel: 'Publicação',
    }
  );
}

export function countCharacters(value) {
  return Array.from(String(value ?? '')).length;
}

export function formatHandle(channelId, handle) {
  const trimmed = String(handle ?? '').trim();
  const clean = trimmed.replace(/^@+/, '').trim();
  if (!clean || clean === '.' || clean === '..') {
    return DEFAULT_HANDLES[channelId] ?? '@canal';
  }
  if (channelId === 'instagram' || channelId === 'x' || channelId === 'tiktok') {
    return `@${clean}`;
  }
  return clean;
}
