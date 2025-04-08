import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface WebRTCRecordingPlayerProps {
  recordingUrl?: string;
  thumbnail?: string;
  title?: string;
}

export function WebRTCRecordingPlayer({ 
  recordingUrl, 
  thumbnail,
  title
}: WebRTCRecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize video player when component mounts
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Set up event listeners
    const onLoadedMetadata = () => {
      setDuration(videoElement.duration);
      setIsLoading(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
    };

    const onError = () => {
      setError('Failed to load recording');
      setIsLoading(false);
    };

    videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
    videoElement.addEventListener('timeupdate', onTimeUpdate);
    videoElement.addEventListener('ended', onEnded);
    videoElement.addEventListener('error', onError);

    // Clean up event listeners
    return () => {
      videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoElement.removeEventListener('timeupdate', onTimeUpdate);
      videoElement.removeEventListener('ended', onEnded);
      videoElement.removeEventListener('error', onError);
    };
  }, []);

  // Load the video source when recordingUrl changes
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !recordingUrl) return;

    setIsLoading(true);
    setError(null);

    try {
      videoElement.src = recordingUrl;
      videoElement.load();
    } catch (err) {
      console.error('Error loading video:', err);
      setError('Failed to load recording');
      setIsLoading(false);
    }
  }, [recordingUrl]);

  // Handle play/pause
  const togglePlay = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isPlaying) {
      videoElement.pause();
    } else {
      videoElement.play().catch(err => {
        console.error('Error playing video:', err);
        setError('Failed to play recording');
      });
    }
    setIsPlaying(!isPlaying);
  };

  // Handle seeking
  const handleSeek = (value: number[]) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const newTime = value[0];
    videoElement.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const newVolume = value[0];
    videoElement.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  // Toggle mute
  const toggleMute = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const newMutedState = !isMuted;
    videoElement.muted = newMutedState;
    setIsMuted(newMutedState);
  };

  // Skip backward 10 seconds
  const skipBackward = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const newTime = Math.max(0, videoElement.currentTime - 10);
    videoElement.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Skip forward 10 seconds
  const skipForward = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const newTime = Math.min(videoElement.duration, videoElement.currentTime + 10);
    videoElement.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Format time as MM:SS
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '00:00';
    
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // If no recording URL is provided
  if (!recordingUrl && !isLoading) {
    return (
      <div className="relative aspect-video bg-primary-dark/30 overflow-hidden flex items-center justify-center">
        {thumbnail ? (
          <div className="absolute inset-0">
            <img 
              src={thumbnail} 
              alt={title || "Recording thumbnail"} 
              className="w-full h-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center p-4">
              <h3 className="text-xl font-semibold text-white mb-2">{title || "Recording Unavailable"}</h3>
              <p className="text-gray-300">This recording is no longer available or has been removed.</p>
            </div>
          </div>
        ) : (
          <div className="text-center p-4">
            <h3 className="text-xl font-semibold text-white mb-2">Recording Unavailable</h3>
            <p className="text-gray-300">No recording was found for this livestream.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-primary-dark/30 overflow-hidden">
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        poster={thumbnail}
        playsInline
      >
        {recordingUrl && <source src={recordingUrl} type="video/mp4" />}
        Your browser does not support the video tag.
      </video>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="animate-spin h-12 w-12 border-4 border-accent border-t-transparent rounded-full"></div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center p-4">
            <h3 className="text-xl font-semibold text-white mb-2">Error</h3>
            <p className="text-gray-300">{error}</p>
          </div>
        </div>
      )}

      {/* Controls overlay - only shown when not loading */}
      {!isLoading && !error && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress bar */}
          <div className="mb-2">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-xs text-white/80 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={skipBackward}
            >
              <SkipBack className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={togglePlay}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={skipForward}
            >
              <SkipForward className="h-5 w-5" />
            </Button>

            <div className="flex items-center ml-auto space-x-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={toggleMute}
              >
                {isMuted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </Button>

              <div className="w-24">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}