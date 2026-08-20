/**
 * Avatar Utilities
 * 
 * Functions for generating consistent avatar colors and initials.
 */

import { AVATAR_COLORS } from "./constants";
import { getInitials } from "./format";

/**
 * Get consistent avatar color based on ID
 * Same ID will always return the same color
 * 
 * @example getAvatarColor("user-123") // "#FF6B6B"
 */
export const getAvatarColor = (id: string): string => {
  if (!id) return AVATAR_COLORS[0];
  
  const hash = id.split("").reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

/**
 * Generate avatar data with initials and color
 * 
 * @example generateAvatar("محمد أحمد", "user-123")
 * // { initials: "مأ", color: "#FF6B6B" }
 */
export const generateAvatar = (name: string, id: string) => {
  return {
    initials: getInitials(name),
    color: getAvatarColor(id),
  };
};
