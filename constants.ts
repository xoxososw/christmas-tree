import { Color } from 'three';

export const COLORS = {
  EMERALD_DEEP: new Color('#004028'),
  EMERALD_LIGHT: new Color('#00FF88'), // Brighter for particles
  GOLD_HIGHLIGHT: new Color('#FFD700'),
  GOLD_DARK: new Color('#FFA500'),
  SILVER: new Color('#C0C0C0'),
  RED_VELVET: new Color('#800020'),
};

export const CONFIG = {
  NEEDLE_COUNT: 12000, 
  ORNAMENT_COUNT: 3000, 
  LIGHT_COUNT: 200,
  // Increased size (sweet spot between 9 and 15)
  TREE_HEIGHT: 11, 
  TREE_RADIUS: 4.0,
  CHAOS_RADIUS: 35,
  // Camera closer (32) to fill screen, Y at center
  CAMERA_POS: [0, 0, 32] as [number, number, number],
};