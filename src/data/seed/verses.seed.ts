import type { Verse } from '../../types';
import { splitVerseIntoWords } from '../../lib/hint';

const SEED_CREATED_AT = '2026-01-01T00:00:00.000Z';
const TRANSLATION = 'WEB';

function verse(
  id: string,
  reference: string,
  text: string,
  collectionId: string,
  order: number
): Verse {
  return {
    id,
    reference,
    text,
    translation: TRANSLATION,
    collectionId,
    order,
    wordCount: splitVerseIntoWords(text).length,
    createdAt: SEED_CREATED_AT,
    source: 'seed',
  };
}

export const SEED_VERSES: Verse[] = [
  // Faith
  verse(
    'verse-hebrews-11-1',
    'Hebrews 11:1',
    'Now faith is assurance of things hoped for, proof of things not seen.',
    'collection-faith',
    0
  ),
  verse(
    'verse-romans-10-17',
    'Romans 10:17',
    'So faith comes by hearing, and hearing by the word of God.',
    'collection-faith',
    1
  ),
  verse(
    'verse-proverbs-3-5-6',
    'Proverbs 3:5-6',
    "Trust in Yahweh with all your heart, and don't lean on your own understanding. In all your ways acknowledge him, and he will make your paths straight.",
    'collection-faith',
    2
  ),
  verse(
    'verse-mark-11-24',
    'Mark 11:24',
    'Therefore I tell you, all things whatever you pray and ask for, believe that you have received them, and you shall have them.',
    'collection-faith',
    3
  ),
  verse(
    'verse-2corinthians-5-7',
    '2 Corinthians 5:7',
    'for we walk by faith, not by sight.',
    'collection-faith',
    4
  ),

  // Fear & Anxiety
  verse(
    'verse-philippians-4-6-7',
    'Philippians 4:6-7',
    'In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus.',
    'collection-fear',
    0
  ),
  verse(
    'verse-isaiah-41-10',
    'Isaiah 41:10',
    "Don't you be afraid, for I am with you. Don't be dismayed, for I am your God. I will strengthen you. Yes, I will help you. Yes, I will uphold you with the right hand of my righteousness.",
    'collection-fear',
    1
  ),
  verse(
    'verse-2timothy-1-7',
    '2 Timothy 1:7',
    "For God didn't give us a spirit of fear, but of power, love, and self-control.",
    'collection-fear',
    2
  ),
  verse(
    'verse-joshua-1-9',
    'Joshua 1:9',
    "Haven't I commanded you? Be strong and courageous. Don't be afraid. Don't be dismayed, for Yahweh your God is with you wherever you go.",
    'collection-fear',
    3
  ),
  verse(
    'verse-1peter-5-7',
    '1 Peter 5:7',
    'casting all your worries on him, because he cares for you.',
    'collection-fear',
    4
  ),

  // Identity in Christ
  verse(
    'verse-2corinthians-5-17',
    '2 Corinthians 5:17',
    'Therefore if anyone is in Christ, he is a new creation. The old things have passed away. Behold, all things have become new.',
    'collection-identity',
    0
  ),
  verse(
    'verse-ephesians-2-10',
    'Ephesians 2:10',
    'For we are his workmanship, created in Christ Jesus for good works, which God prepared before that we would walk in them.',
    'collection-identity',
    1
  ),
  verse(
    'verse-galatians-2-20',
    'Galatians 2:20',
    'I have been crucified with Christ, and it is no longer I who live, but Christ lives in me. That life which I now live in the flesh, I live by faith in the Son of God, who loved me and gave himself up for me.',
    'collection-identity',
    2
  ),
  verse(
    'verse-psalm-139-14',
    'Psalm 139:14',
    'I will give thanks to you, for I am fearfully and wonderfully made. Your works are wonderful. My soul knows that very well.',
    'collection-identity',
    3
  ),
  verse(
    'verse-romans-8-1',
    'Romans 8:1',
    "There is therefore now no condemnation to those who are in Christ Jesus, who don't walk according to the flesh, but according to the Spirit.",
    'collection-identity',
    4
  ),
];
