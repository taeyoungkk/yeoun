import Mapbox from '@rnmapbox/maps';

export const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';

export function configureMapbox() {
  if (MAPBOX_ACCESS_TOKEN) {
    Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
  }

  return Boolean(MAPBOX_ACCESS_TOKEN);
}
