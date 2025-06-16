/**
 * Roblox service helpers for profile lookups.
 * @module services/roblox
 */
import noblox from "noblox.js";

/**
 * Fetch Roblox profile info and avatar for a username.
 * @param username - Roblox username
 * @returns Profile info and avatar URL, or null if not found
 */
export async function getRobloxProfile(username: string): Promise<{
  robloxId: number;
  displayName: string;
  age: number;
  avatarUrl: string;
  profileUrl: string;
} | null> {
  try {
    const robloxId = await noblox.getIdFromUsername(username);
    const info = await noblox.getPlayerInfo(robloxId);
    const [thumb] = (await noblox.getPlayerThumbnail([robloxId], 420, "png", false, "headshot")) as unknown as { imageUrl: string }[];
    return {
      robloxId,
      displayName: info.displayName || username,
      age: info.age ?? 0,
      avatarUrl: thumb?.imageUrl ?? "",
      profileUrl: `https://www.roblox.com/users/${robloxId}/profile`,
    };
  } catch {
    return null;
  }
}
