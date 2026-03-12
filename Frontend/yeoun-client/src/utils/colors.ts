export function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Generate a hue value between 0 and 360
  const hue = Math.abs(hash % 360);
  
  // Return an earthy/pastel tone (moderate saturation and lightness)
  // This matches the muted aesthetic of your design layout.
  return `hsl(${hue}, 45%, 65%)`;
}
