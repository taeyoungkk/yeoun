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
