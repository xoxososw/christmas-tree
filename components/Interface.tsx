import React, { useRef, useCallback, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';
import { TreeState } from '../types';

interface InterfaceProps {
  onStateChange: (state: TreeState) => void;
  currentState: TreeState;
  onPhotoUpload: (files: FileList) => void;
  onManualInteract: (isInteracting: boolean) => void;
  photoCount: number;
}

export const Interface: React.FC<InterfaceProps> = ({ 
  onStateChange, 
  currentState, 
  onPhotoUpload,
  onManualInteract,
  photoCount
}) => {
  const [showCamera, setShowCamera] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [debugRatio, setDebugRatio] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingMusic, setIsLoadingMusic] = useState(false);
  
  const webcamRef = useRef<Webcam>(null);
  const requestRef = useRef<number>(0);
  const modelRef = useRef<handpose.HandPose | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  // Helper to construct correct path based on environment
  const getAudioUrl = (filename: string) => {
      // @ts-ignore
      const baseUrl = import.meta.env.BASE_URL;
      // Handle cases where baseUrl might be '/' or '/repo-name/'
      const safeBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      return `${safeBase}${filename}`;
  };

  // 1. Toggle Play/Pause
  const toggleMusic = () => {
    // A. Initialize if not exists
    if (!audioRef.current) {
        setIsLoadingMusic(true);
        
        // Construct URL
        const audioUrl = getAudioUrl('3311088699.mp3');
        console.log("Attempting to play audio from:", audioUrl);

        const audio = new Audio(audioUrl);
        audio.loop = true;
        audio.volume = 0.8;
        
        // Assign ref immediately
        audioRef.current = audio;

        // Try playing IMMEDIATELY (Don't wait for events, helps with browser autoplay policies)
        audio.play()
            .then(() => {
                console.log("Audio started successfully");
                setIsPlaying(true);
                setIsLoadingMusic(false);
            })
            .catch((e) => {
                console.error("Audio playback failed:", e);
                setIsLoadingMusic(false);
                setIsPlaying(false);
                alert(`Cannot play music. Path: ${audioUrl}. Error: ${e.message}`);
                // If failed, reset ref so user can try again
                audioRef.current = null;
            });

        return;
    }

    // B. Toggle existing
    if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
    } else {
        audioRef.current.play()
            .then(() => setIsPlaying(true))
            .catch(e => console.error("Resume failed:", e));
    }
  };

  // 2. Handle Local File Selection (Override)
  const handleMusicSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          const objectUrl = URL.createObjectURL(file);
          
          if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.src = objectUrl;
          } else {
              audioRef.current = new Audio(objectUrl);
              audioRef.current.loop = true;
              audioRef.current.volume = 0.8;
          }
          
          setIsLoadingMusic(true);
          audioRef.current.play()
            .then(() => {
                setIsPlaying(true);
                setIsLoadingMusic(false);
            })
            .catch(e => {
                console.error("Local file play error", e);
                setIsLoadingMusic(false);
            });
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onPhotoUpload(e.target.files);
    }
  };

  const runHandpose = async () => {
      // Load model if not loaded
      if (!modelRef.current) {
         try {
             await tf.ready();
             const model = await handpose.load();
             modelRef.current = model;
             setModelLoaded(true);
             console.log("Handpose model loaded");
         } catch (err) {
             console.error("Failed to load handpose", err);
             return;
         }
      }
      
      detect(modelRef.current);
  };

  const detect = async (net: handpose.HandPose) => {
      if (
          typeof webcamRef.current !== "undefined" &&
          webcamRef.current !== null &&
          webcamRef.current.video &&
          webcamRef.current.video.readyState === 4
      ) {
          const video = webcamRef.current.video;
          const videoWidth = webcamRef.current.video.videoWidth;
          const videoHeight = webcamRef.current.video.videoHeight;
          
          webcamRef.current.video.width = videoWidth;
          webcamRef.current.video.height = videoHeight;

          const hand = await net.estimateHands(video);

          if (hand.length > 0) {
              const landmarks = hand[0].landmarks;
              
              // 1. Perspective Control
              const [x, y] = landmarks[0]; 
              const normX = 1 - (x / videoWidth);
              const normY = y / videoHeight;
              
              const evt = new MouseEvent('mousemove', {
                  clientX: normX * window.innerWidth,
                  clientY: normY * window.innerHeight,
                  bubbles: true
              });
              window.dispatchEvent(evt);

              // 2. Gesture Detection (Open vs Closed)
              const wrist = landmarks[0];
              const tip = landmarks[12]; // Middle finger tip
              const mcp = landmarks[9];  // Middle finger knuckle

              // Calculate Euclidian distance
              const distToTip = Math.sqrt(Math.pow(tip[0]-wrist[0], 2) + Math.pow(tip[1]-wrist[1], 2));
              const distToMcp = Math.sqrt(Math.pow(mcp[0]-wrist[0], 2) + Math.pow(mcp[1]-wrist[1], 2));
              
              const ratio = distToTip / distToMcp;
              setDebugRatio(ratio);
              
              // Logic: 
              // Large Ratio (> 1.5) means finger is far extended relative to knuckle -> Open Hand -> Chaos
              // Small Ratio (< 1.3) means finger is close to knuckle -> Fist -> Formed
              
              if (ratio > 1.5) {
                  onManualInteract(true); // Chaos (Unleash)
              } else if (ratio < 1.35) {
                  onManualInteract(false); // Formed (Tree)
              }
          }
      }
      requestRef.current = requestAnimationFrame(() => detect(net));
  };

  const toggleCamera = () => {
      const nextState = !showCamera;
      setShowCamera(nextState);
      if (nextState) {
          setTimeout(() => {
              runHandpose();
          }, 1000); 
      } else {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      }
  };

  useEffect(() => {
      return () => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
          if (audioRef.current) {
              audioRef.current.pause();
          }
      };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10">
      
      {/* Header Removed - Buttons Only */}
      <div className="flex w-full justify-end items-start pointer-events-auto gap-3">
        
        {/* === NEW: Custom Music Upload === */}
        <input 
            type="file" 
            accept="audio/*" 
            ref={musicInputRef} 
            className="hidden" 
            onChange={handleMusicSelect} 
        />
        <button 
            onClick={() => musicInputRef.current?.click()}
            className="px-3 py-3 rounded border border-yellow-800 bg-black/60 text-yellow-500 hover:bg-yellow-900/30 transition-all flex items-center gap-2"
            title="Upload Local MP3"
        >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden md:inline">Custom Song</span>
        </button>

        {/* Play/Pause Button */}
        <button 
            onClick={toggleMusic}
            disabled={isLoadingMusic}
            className={`px-4 py-3 rounded border transition-all flex items-center gap-2 min-w-[140px] justify-center
              ${isPlaying 
                  ? 'bg-yellow-600/80 text-white border-white animate-pulse' 
                  : 'bg-black/50 text-yellow-500 border-yellow-600'
              }
              ${isLoadingMusic ? 'opacity-50 cursor-not-allowed' : ''}
            `}
        >
            {isLoadingMusic ? (
                 <span>Loading...</span>
            ) : isPlaying ? (
                 <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Playing</span>
                 </>
            ) : (
                 <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Play Music</span>
                 </>
            )}
        </button>

        <label className="cursor-pointer group">
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
            <div className="bg-emerald-900/80 hover:bg-emerald-800 text-yellow-400 border border-yellow-600 px-6 py-3 rounded shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden md:inline">Add Memories</span>
                <span className="md:hidden">Add</span>
            </div>
        </label>

        <button 
            onClick={toggleCamera}
            className={`px-6 py-3 rounded border transition-all flex items-center gap-2 ${showCamera ? 'bg-yellow-600/80 text-white border-white' : 'bg-black/50 text-yellow-500 border-yellow-600'}`}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="hidden md:inline">{showCamera ? 'Disable Gestures' : 'Enable Gestures'}</span>
            <span className="md:hidden">Cam</span>
        </button>
      </div>

      {/* Camera Feed Overlay with Debug Info */}
      {showCamera && (
          <div className="absolute top-32 right-6 w-52 h-auto bg-black border-2 border-yellow-600 rounded overflow-hidden shadow-2xl pointer-events-auto">
             <div className="h-36 relative">
                 <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "user" }}
                    className="w-full h-full object-cover transform scale-x-[-1]" 
                 />
                 {/* Live Feedback Overlay */}
                 {modelLoaded && (
                    <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] text-green-400 font-mono">
                        Val: {debugRatio.toFixed(2)}
                    </div>
                 )}
             </div>
             
             <div className="w-full bg-gray-900 p-3 text-xs text-yellow-100 border-t border-yellow-800">
                 {!modelLoaded ? (
                     <div className="flex items-center gap-2">
                         <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse"></div>
                         Loading AI Model...
                     </div>
                 ) : (
                     <div className="flex flex-col gap-1">
                         <div className="flex justify-between">
                            <span>🖐 Open Hand:</span>
                            <span className={debugRatio > 1.5 ? "text-green-400 font-bold" : "text-gray-500"}>CHAOS ({">1.5"})</span>
                         </div>
                         <div className="flex justify-between">
                            <span>✊ Fist:</span>
                            <span className={debugRatio < 1.35 ? "text-green-400 font-bold" : "text-gray-500"}>TREE ({"<1.35"})</span>
                         </div>
                     </div>
                 )}
             </div>
          </div>
      )}

      {/* Main Interaction Controls */}
      <div className="flex flex-col items-center pointer-events-auto pb-10">
          <div 
            className="relative group cursor-pointer"
            onMouseDown={() => onManualInteract(true)}
            onMouseUp={() => onManualInteract(false)}
            onTouchStart={() => onManualInteract(true)}
            onTouchEnd={() => onManualInteract(false)}
          >
             <div className={`
                w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all duration-500
                ${currentState === TreeState.CHAOS ? 'bg-red-900/80 border-red-500 scale-110' : 'bg-emerald-900/80 border-yellow-500'}
                shadow-[0_0_30px_rgba(255,215,0,0.4)]
             `}>
                 <span className="text-3xl filter drop-shadow-lg">
                    {currentState === TreeState.CHAOS ? '💥' : '🎄'}
                 </span>
             </div>
             
             <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 w-64 text-center">
                 <p className="text-yellow-200 text-sm font-bold uppercase tracking-widest bg-black/60 px-2 py-1 rounded">
                    {currentState === TreeState.CHAOS ? 'Releasing...' : 'Hold / Open Hand'}
                 </p>
             </div>
          </div>

          {/* Photo Counter Display */}
          <p className="mt-4 text-gray-400 text-xs text-center max-w-md">
             Use Camera Gestures or Hold Button to control. <br/>
             <span className="text-yellow-500 font-bold">{photoCount}</span> Photos on Tree
          </p>
      </div>
    </div>
  );
};