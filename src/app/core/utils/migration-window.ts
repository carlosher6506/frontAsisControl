export const migrationTitle = 'Aviso de migración';
export const migrationMessage =
  'Estamos migrando AsisControl a un nuevo sistema. El acceso estará inhabilitado el 17 de noviembre de 2026, de 6:00 a. m. a 8:00 p. m. (hora de Cancún).';

const startsAt = Date.parse('2026-11-17T06:00:00-05:00');
const endsAt = Date.parse('2026-11-17T20:00:00-05:00');

export function migrationActive(now = Date.now()): boolean {
  return now >= startsAt && now < endsAt;
}

export function showMigrationAnnouncement(now = Date.now()): boolean {
  return now >= startsAt - 6 * 60 * 60 * 1000 && now < endsAt;
}
