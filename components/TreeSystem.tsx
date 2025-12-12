import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { InstancedMesh, Object3D, Vector3, MathUtils, TextureLoader, DoubleSide, AdditiveBlending, CanvasTexture, Shape, Group, Euler, Quaternion } from 'three';
import { CONFIG, COLORS } from '../constants';
import { TreeState, PhotoData } from '../types';

interface TreeSystemProps {
  state: TreeState;
  photos: PhotoData[];
  mousePos: { x: number; y: number };
}

// --- Helpers ---

const getRandomSpherePoint = (radius: number) => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = Math.cbrt(Math.random()) * radius;
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(phi);
  return new Vector3(x, y, z);
};

// Procedural Soft Glow Texture
const useSparkleTexture = () => {
    return useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d')!;
        
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);

        const tex = new CanvasTexture(canvas);
        return tex;
    }, []);
};

// --- Subcomponent: Top Star ---
const TopStar = ({ state }: { state: TreeState }) => {
    const meshRef = useRef<Object3D>(null);
    
    const starShape = useMemo(() => {
        const shape = new Shape();
        const outerRadius = 0.8;
        const innerRadius = 0.35;
        const points = 5;
        for (let i = 0; i < points * 2; i++) {
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const r = i % 2 === 0 ? outerRadius : innerRadius;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        }
        shape.closePath();
        return shape;
    }, []);

    useFrame((stateThree) => {
        if(!meshRef.current) return;
        const time = stateThree.clock.getElapsedTime();
        // Star spins independently
        meshRef.current.rotation.y = time * 0.5;
        // Float effect
        meshRef.current.position.y = (CONFIG.TREE_HEIGHT / 2) + 0.5 + Math.sin(time * 2) * 0.1;
        
        const scale = state === TreeState.FORMED ? 1 : 0.1;
        meshRef.current.scale.lerp(new Vector3(scale, scale, scale), 0.05);
    });

    return (
        <group ref={meshRef}>
            <mesh>
                <extrudeGeometry args={[starShape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.05, bevelSegments: 2 }]} />
                <meshStandardMaterial 
                    color={COLORS.GOLD_HIGHLIGHT} 
                    emissive={COLORS.GOLD_HIGHLIGHT}
                    emissiveIntensity={3} 
                    roughness={0.1}
                    metalness={1}
                />
            </mesh>
            <pointLight distance={10} intensity={2} color="#ffaa00" />
        </group>
    );
}

// --- Subcomponent: Gold Spiral Ribbons ---
const GoldRibbons = ({ state }: { state: TreeState }) => {
  const pointsRef = useRef<any>(null);
  const count = CONFIG.ORNAMENT_COUNT;
  const texture = useSparkleTexture();

  const [positions, targetPositions, chaosPositions, colors, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const chaos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    const sz = new Float32Array(count);

    const spirals = 5.5; // Number of turns
    const height = CONFIG.TREE_HEIGHT;
    const maxRadius = CONFIG.TREE_RADIUS + 0.5; // Slightly outside the green

    for (let i = 0; i < count; i++) {
      // 1. Target: Spiral Logic
      const pct = i / count; // 0 to 1
      
      // y goes from bottom to top
      const y = pct * height - height / 2;
      
      // Radius decreases as we go up
      const r = (1 - pct) * maxRadius;
      
      // Angle increases to create spiral
      const theta = pct * (Math.PI * 2 * spirals);
      
      // Add a little bit of spread/jitter to make the ribbon look like "dust" not a line
      const jitter = 0.6;
      const jx = (Math.random() - 0.5) * jitter;
      const jz = (Math.random() - 0.5) * jitter;
      const jy = (Math.random() - 0.5) * jitter;

      const tx = r * Math.cos(theta) + jx;
      const ty = y + jy;
      const tz = r * Math.sin(theta) + jz;

      target[i * 3] = tx;
      target[i * 3 + 1] = ty;
      target[i * 3 + 2] = tz;

      // 2. Chaos: Sphere
      const c = getRandomSpherePoint(CONFIG.CHAOS_RADIUS);
      chaos[i * 3] = c.x;
      chaos[i * 3 + 1] = c.y;
      chaos[i * 3 + 2] = c.z;

      // Init
      pos[i * 3] = c.x;
      pos[i * 3 + 1] = c.y;
      pos[i * 3 + 2] = c.z;

      // 3. Color: Gold gradient
      const color = Math.random() > 0.5 ? COLORS.GOLD_HIGHLIGHT : COLORS.GOLD_DARK;
      cols[i * 3] = color.r;
      cols[i * 3 + 1] = color.g;
      cols[i * 3 + 2] = color.b;
      
      // 4. Size: Varied
      sz[i] = Math.random() * 0.5 + 0.3;
    }
    return [pos, target, chaos, cols, sz];
  }, []);

  useFrame((stateThree) => {
    if (!pointsRef.current) return;
    const isFormed = state === TreeState.FORMED;
    const currentPositions = pointsRef.current.geometry.attributes.position.array;
    
    // Animate
    for (let i = 0; i < count; i++) {
        const ix = i * 3;
        const iy = i * 3 + 1;
        const iz = i * 3 + 2;

        const tx = isFormed ? targetPositions[ix] : chaosPositions[ix];
        const ty = isFormed ? targetPositions[iy] : chaosPositions[iy];
        const tz = isFormed ? targetPositions[iz] : chaosPositions[iz];

        currentPositions[ix] += (tx - currentPositions[ix]) * 0.05;
        currentPositions[iy] += (ty - currentPositions[iy]) * 0.05;
        currentPositions[iz] += (tz - currentPositions[iz]) * 0.05;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={sizes} itemSize={1} />
      </bufferGeometry>
      <pointsMaterial 
        map={texture}
        size={0.6} 
        vertexColors 
        transparent 
        opacity={1} 
        blending={AdditiveBlending}
        depthWrite={false}
        sizeAttenuation={true}
      />
    </points>
  );
};

// --- Subcomponent: Green Glitter Dust (The Tree Body) ---
const GreenDust = ({ state }: { state: TreeState }) => {
  const pointsRef = useRef<any>(null);
  const count = CONFIG.NEEDLE_COUNT;
  const texture = useSparkleTexture();
  
  const [positions, targetPositions, chaosPositions, colors, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const chaos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    const sz = new Float32Array(count);

    const height = CONFIG.TREE_HEIGHT;
    const radiusBase = CONFIG.TREE_RADIUS;

    for (let i = 0; i < count; i++) {
      // 1. Target: Cone Volume with Spiral Bias
      const yNorm = Math.random(); // 0 to 1
      const y = yNorm * height - height / 2;
      const maxR = (1 - yNorm) * radiusBase;
      const r = Math.sqrt(Math.random()) * maxR; // Uniform distribution in circle
      const theta = Math.random() * Math.PI * 2;

      // Add a slight swirl bias to the body too
      const swirlOffset = yNorm * Math.PI; 
      const tx = r * Math.cos(theta + swirlOffset);
      const tz = r * Math.sin(theta + swirlOffset);

      target[i * 3] = tx;
      target[i * 3 + 1] = y;
      target[i * 3 + 2] = tz;

      // 2. Chaos
      const c = getRandomSpherePoint(CONFIG.CHAOS_RADIUS * 1.2);
      chaos[i * 3] = c.x;
      chaos[i * 3 + 1] = c.y;
      chaos[i * 3 + 2] = c.z;

      // Init
      pos[i * 3] = c.x;
      pos[i * 3 + 1] = c.y;
      pos[i * 3 + 2] = c.z;

      // 3. Color: Mix of Deep Emerald and Bright Teal/Green
      const isBright = Math.random() > 0.7;
      const color = isBright ? COLORS.EMERALD_LIGHT : COLORS.EMERALD_DEEP;
      cols[i * 3] = color.r;
      cols[i * 3 + 1] = color.g;
      cols[i * 3 + 2] = color.b;

      sz[i] = Math.random() * 0.4 + 0.1;
    }
    return [pos, target, chaos, cols, sz];
  }, []);

  useFrame((stateThree) => {
    if (!pointsRef.current) return;
    const isFormed = state === TreeState.FORMED;
    const currentPositions = pointsRef.current.geometry.attributes.position.array;
    
    for (let i = 0; i < count; i++) {
        const ix = i * 3;
        const iy = i * 3 + 1;
        const iz = i * 3 + 2;

        const tx = isFormed ? targetPositions[ix] : chaosPositions[ix];
        const ty = isFormed ? targetPositions[iy] : chaosPositions[iy];
        const tz = isFormed ? targetPositions[iz] : chaosPositions[iz];

        currentPositions[ix] += (tx - currentPositions[ix]) * 0.04;
        currentPositions[iy] += (ty - currentPositions[iy]) * 0.04;
        currentPositions[iz] += (tz - currentPositions[iz]) * 0.04;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={sizes} itemSize={1} />
      </bufferGeometry>
      <pointsMaterial 
        map={texture}
        size={0.4} 
        vertexColors 
        transparent 
        opacity={0.8} 
        blending={AdditiveBlending}
        depthWrite={false}
        sizeAttenuation={true}
      />
    </points>
  );
};

// --- Subcomponent: Polaroids (Updated Placement) ---

interface PolaroidProps {
  photo: PhotoData;
  state: TreeState;
  index: number;
  totalCount: number;
}

const Polaroid: React.FC<PolaroidProps> = ({ photo, state, index, totalCount }) => {
    const meshRef = useRef<Group>(null);
    const texture = useMemo(() => new TextureLoader().load(photo.url), [photo.url]);
    
    // Calculate positions dynamically based on TOTAL count
    const { targetPos, chaosPos, targetRotationQ } = useMemo(() => {
        const h = CONFIG.TREE_HEIGHT;
        const rBase = CONFIG.TREE_RADIUS;
        
        const minY = -h / 2 + 1.5; 
        const maxY = h / 2 - 2.0;  
        const rangeY = maxY - minY;

        let y = 0;
        if (totalCount <= 1) {
            y = (minY + maxY) / 2;
        } else {
            const ratio = index / (totalCount - 1);
            y = minY + ratio * rangeY;
        }

        const coneProgress = (y + h/2) / h; 
        const coneRadius = (1 - coneProgress) * rBase;
        
        // Ensure it sits comfortably outside needles
        const r = coneRadius + 1.5; 
        
        const angle = index * 2.39996; 
        
        const target = new Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r);
        
        // Calculate the Rotation Quaternion needed to face OUTWARDS
        // "LookAt" logic:
        // 1. Create a dummy object at target position
        // 2. Look at center (0, y, 0) -> this is Inwards
        // 3. Rotate 180 deg to face Outwards
        const dummy = new Object3D();
        dummy.position.copy(target);
        dummy.lookAt(0, y, 0); // Looks inwards
        dummy.rotateY(Math.PI); // Flip to look outwards
        const q = dummy.quaternion.clone();

        const chaos = getRandomSpherePoint(CONFIG.CHAOS_RADIUS * 0.8);
        
        return { targetPos: target, chaosPos: chaos, targetRotationQ: q };
    }, [index, totalCount]);

    useFrame((stateThree, delta) => {
        if (!meshRef.current) return;
        const isFormed = state === TreeState.FORMED;
        const target = isFormed ? targetPos : chaosPos;

        // 1. Position Lerp
        meshRef.current.position.lerp(target, 0.03);
        
        // 2. Rotation Handling
        if (isFormed) {
             // In Formed state, strictly LERP to the pre-calculated outward orientation
             meshRef.current.quaternion.slerp(targetRotationQ, 0.05);
        } else {
             // In Chaos state, spin randomly
             meshRef.current.rotation.x += 0.02;
             meshRef.current.rotation.z += 0.02;
        }
    });

    return (
        <group ref={meshRef}>
            {/* White Frame Body */}
            <mesh position={[0, 0, -0.01]}>
                <boxGeometry args={[1.5, 1.8, 0.05]} /> 
                <meshStandardMaterial color="#f8f8f8" roughness={0.5} metalness={0} />
            </mesh>
            
            {/* Front Photo */}
            <mesh position={[0, 0.15, 0.02]}>
                <planeGeometry args={[1.3, 1.3]} />
                <meshStandardMaterial 
                    map={texture} 
                    side={DoubleSide} // Ensure visible if camera clips slightly
                    roughness={0.4} 
                    metalness={0}
                    emissive="black" 
                />
            </mesh>

            {/* Back Photo (Mirrored logic) - Ensures visibility from behind */}
            {/* Placed at -0.04 (just behind the box which is -0.01 center +/- 0.025) */}
            <mesh position={[0, 0.15, -0.04]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[1.3, 1.3]} />
                <meshStandardMaterial 
                    map={texture} 
                    side={DoubleSide} 
                    roughness={0.4} 
                    metalness={0}
                    emissive="black" 
                />
            </mesh>
        </group>
    );
};

export const TreeSystem: React.FC<TreeSystemProps> = ({ state, photos, mousePos }) => {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    
    const targetRotation = (mousePos.x - 0.5) * Math.PI * 2.5; 
    groupRef.current.rotation.y = MathUtils.lerp(groupRef.current.rotation.y, targetRotation, 0.05);
  });

  return (
    <group ref={groupRef}>
      <TopStar state={state} />
      <GoldRibbons state={state} />
      <GreenDust state={state} />
      {photos.map((photo, i) => (
          <Polaroid 
            key={photo.id} 
            photo={photo} 
            state={state} 
            index={i} 
            totalCount={photos.length} 
          />
      ))}
    </group>
  );
};