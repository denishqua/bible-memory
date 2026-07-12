import type { Collection } from '../../types';

export const SEED_COLLECTIONS: Collection[] = [
  {
    id: 'collection-faith',
    title: 'Faith',
    description: 'Verses on trusting God even when you can\'t see the outcome.',
    icon: '🕊️',
    order: 0,
    unlockRule: { type: 'always' },
    verseIds: [
      'verse-hebrews-11-1',
      'verse-romans-10-17',
      'verse-proverbs-3-5-6',
      'verse-mark-11-24',
      'verse-2corinthians-5-7',
    ],
  },
  {
    id: 'collection-fear',
    title: 'Fear & Anxiety',
    description: "Verses for when your mind won't stop racing.",
    icon: '🛡️',
    order: 1,
    unlockRule: { type: 'requiresCollection', requiredCollectionId: 'collection-faith' },
    verseIds: [
      'verse-philippians-4-6-7',
      'verse-isaiah-41-10',
      'verse-2timothy-1-7',
      'verse-joshua-1-9',
      'verse-1peter-5-7',
    ],
  },
  {
    id: 'collection-identity',
    title: 'Identity in Christ',
    description: 'Verses on who God says you are.',
    icon: '👑',
    order: 2,
    unlockRule: { type: 'requiresCollection', requiredCollectionId: 'collection-fear' },
    verseIds: [
      'verse-2corinthians-5-17',
      'verse-ephesians-2-10',
      'verse-galatians-2-20',
      'verse-psalm-139-14',
      'verse-romans-8-1',
    ],
  },
];
