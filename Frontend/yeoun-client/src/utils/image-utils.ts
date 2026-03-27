/**
 * Utility for consistent trip placeholder image selection.
 * Derives the placeholder from the tripId to ensure the same trip always has the same image.
 */
export const getTripPlaceholder = (tripId: string) => {
  if (!tripId) return require('@/assets/images/trip_placeholder_1.png');
  
  // Simple deterministic hash based on tripId characters
  let hash = 0;
  for (let i = 0; i < tripId.length; i++) {
    hash = ((hash << 5) - hash) + tripId.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  
  // Pick one of the two available placeholders
  return Math.abs(hash) % 2 === 0 
    ? require('@/assets/images/trip_placeholder_1.png') 
    : require('@/assets/images/trip_placeholder_2.png');
};

const BASE_URL = 'https://j14b105.p.ssafy.io/api/v1';

export const getProfileImageUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('file://') || url.startsWith('content://') || url.startsWith('data:')) {
    return url;
  }
  
  // If the url already starts with /api/v1, use the domain only
  if (url.startsWith('/api/v1')) {
    return `https://j14b105.p.ssafy.io${url}`;
  }
  
  // Otherwise, prefix with the full API BASE_URL
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};
