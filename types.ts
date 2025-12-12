import { Vector3 } from 'three';

export enum TreeState {
  FORMED = 'FORMED',
  CHAOS = 'CHAOS',
}

export interface ParticleData {
  chaosPos: Vector3;
  targetPos: Vector3;
  scale: number;
  color: string;
  speed: number;
  rotationSpeed: number;
  id: number;
}

export interface PhotoData {
  id: string;
  url: string;
  aspectRatio: number;
}
