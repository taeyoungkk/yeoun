/**
 * Utility for consistent trip placeholder image selection.
 * Derives the placeholder from the tripId to ensure the same trip always has the same image.
 */
export const getTripPlaceholder = (tripId: string) => {
  const hash = (tripId || 'default').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = hash % 3;
  
  if (index === 0) return require('@/assets/images/trip_placeholder_1.png');
  if (index === 1) return require('@/assets/images/trip_placeholder_2.png');
  return require('@/assets/images/trip_placeholder_3.png');
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

/**
 * Returns the trip photo if available, otherwise a deterministic placeholder.
 */
export const getTripImage = (tripId: string, imageUrl?: string | null) => {
  const hasImageUrl = imageUrl && imageUrl.trim().length > 0;
  
  if (hasImageUrl) {
    const url = imageUrl!.trim();
    if (url.startsWith('http') || url.startsWith('file://') || url.startsWith('content://') || url.startsWith('data:')) {
      return url;
    }
    
    if (url.startsWith('/api/v1')) {
      return `https://j14b105.p.ssafy.io${url}`;
    }
    
    return `https://j14b105.p.ssafy.io/api/v1${url.startsWith('/') ? '' : '/'}${url}`;
  }
  
  return getTripPlaceholder(tripId);
};
