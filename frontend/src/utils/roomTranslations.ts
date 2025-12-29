import i18n from '@/i18n';

/**
 * Mapping des noms de pièces stockés en base (anglais) vers les clés de traduction
 */
const ROOM_NAME_TO_TRANSLATION_KEY: Record<string, string> = {
  'home': 'home.rooms.house',
  'garden': 'home.rooms.garden',
  'pool': 'home.rooms.pool',
  'basement': 'home.rooms.basement',
  'garage': 'home.rooms.garage',
  'laundry': 'home.rooms.laundry',
  'entrance': 'home.rooms.hallway',
  'corridor': 'home.rooms.corridor',
  'bedroom': 'home.rooms.bedroom',
  'bathroom': 'home.rooms.bathroom',
  'living room': 'home.rooms.livingRoom',
  'dining room': 'home.rooms.diningRoom',
  'kitchen': 'home.rooms.kitchen',
  'toilet': 'home.rooms.toilet',
  'office': 'home.rooms.office',
  'terrace': 'home.rooms.terrace',
};

/**
 * Traduit un nom de pièce stocké en base vers la traduction correspondante
 * @param roomName - Le nom de la pièce stocké en base (en anglais)
 * @returns Le nom traduit ou le nom original si aucune traduction n'est trouvée
 */
export function translateRoomName(roomName: string | null | undefined): string {
  if (!roomName) {
    return i18n.t('home.unnamedRoom');
  }

  const translationKey = ROOM_NAME_TO_TRANSLATION_KEY[roomName.toLowerCase()];
  if (translationKey) {
    return i18n.t(translationKey);
  }

  // Si aucune traduction n'est trouvée, retourner le nom original
  return roomName;
}

