import {
  imageField,
  localizedTextField,
  numberField,
  relatedList,
  releaseListField,
  textField,
  type EntityDefinition,
} from '../entity/entity-definition';

/**
 * What the cover of a volume must be - the backend's profile `volume`: at least 560 × 800
 * and close to 7:10, a PNG of any background, at most 5 MB and 25 megapixels. The backend
 * fits it into a 420 × 600 canvas.
 */
const VOLUME_COVER = {
  width: 420,
  height: 600,
  minWidth: 560,
  minHeight: 800,
  ratioTolerance: 0.1,
  maxBytes: 5 * 1024 * 1024,
  maxPixels: 25_000_000,
  minTransparentPercent: 0,
};

/**
 * The Volume: a number, a cover, a title per language and, optionally, its Japanese title and
 * its release dates per country. Chapters point to it: its card lists a few.
 */
export const VOLUME: EntityDefinition = {
  entityType: 'VOLUME',
  naturalKey: 'number',
  labelField: 'title',
  route: '/content/volumes',
  api: '/api/content/volumes',
  i18n: 'content.volumes',
  icon: '▮',
  fields: [
    numberField('number'),
    imageField('cover', VOLUME_COVER),
    localizedTextField('title', { maxLength: 200 }),
    textField('japaneseTitle', { maxLength: 200, optional: true, lang: 'ja' }),
    releaseListField('releases'),
  ],
  sections: [relatedList({ of: 'CHAPTER', by: 'volume' })],
};
