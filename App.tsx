import React, { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Environment, Stars, Sparkles, OrbitControls } from '@react-three/drei';
import { TreeSystem } from './components/TreeSystem';
import { Interface } from './components/Interface';
import { TreeState, PhotoData } from './types';
import { CONFIG, COLORS } from './constants';

const App: React.FC = () => {
  const [treeState, setTreeState] = useState<TreeState>(TreeState.FORMED);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePos({
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    });
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  const handlePhotoUpload = (files: FileList) => {
    const newPhotos: PhotoData[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      url: URL.createObjectURL(file),
      aspectRatio: 1
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  const handleInteraction = (isInteracting: boolean) => {
      setTreeState(isInteracting ? TreeState.CHAOS : TreeState.FORMED);
  };

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative">
      
      <Canvas 
        shadows 
        camera={{ position: CONFIG.CAMERA_POS, fov: 40 }}
        gl={{ antialias: false, toneMappingExposure: 1.2 }}
      >
        <color attach="background" args={['#050f0a']} />
        
        {/* === SURROUND LIGHTING SYSTEM === */}
        {/* Ensures photos are visible from ANY angle */}
        <ambientLight intensity={1.5} />

        {/* Front Right */}
        <spotLight 
            position={[15, 10, 20]} 
            angle={0.6} 
            penumbra={1} 
            intensity={1500} 
            color="#fff0dd" 
            castShadow 
        />
        {/* Back Left */}
        <spotLight 
            position={[-15, 10, -15]} 
            angle={0.6} 
            penumbra={1} 
            intensity={1500} 
            color="#e6f2ff" 
        />
        {/* Back Right (Fill) */}
        <spotLight 
            position={[15, 5, -10]} 
            intensity={1000} 
            color="#ffd700" 
        />

        {/* Environment Stars */}
        <Stars radius={100} depth={50} count={7000} factor={4} saturation={0} fade speed={0.5} />
        
        {/* Controls - ZOOM ONLY */}
        <OrbitControls 
            enableZoom={true} 
            enableRotate={false} 
            enablePan={false} 
            minDistance={10} 
            maxDistance={60}
        />

        {/* Core Logic */}
        <TreeSystem state={treeState} photos={photos} mousePos={mousePos} />

        {/* Post Processing */}
        <EffectComposer disableNormalPass>
           <Bloom 
             luminanceThreshold={0.4} 
             mipmapBlur 
             intensity={1.8} 
             radius={0.5}
           />
           <Vignette eskil={false} offset={0.1} darkness={0.5} />
        </EffectComposer>
      </Canvas>

      <Interface 
        currentState={treeState}
        onStateChange={setTreeState}
        onPhotoUpload={handlePhotoUpload}
        onManualInteract={handleInteraction}
        photoCount={photos.length}
      />
    </div>
  );
};

export default App;