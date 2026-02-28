import type { IAgoraRTCClient, ILocalAudioTrack, ILocalVideoTrack, IRemoteVideoTrack, IRemoteAudioTrack } from "agora-rtc-sdk-ng"

export type AgoraJoinRole = "publisher" | "audience"

export interface AgoraJoinConfig {
  channelName: string
  role: AgoraJoinRole
  uid?: number
  appId?: string
  token?: string
  container: HTMLElement
  width?: string | number
  height?: string | number
  enableVideo?: boolean // New: enable video streaming
}

export class AgoraManager {
  private client: IAgoraRTCClient | null = null
  private localAudio: ILocalAudioTrack | null = null
  private localVideo: ILocalVideoTrack | null = null
  private screenVideoTrack: ILocalVideoTrack | null = null
  private screenAudioTrack: ILocalAudioTrack | null = null
  private isJoining: boolean = false
  private videoContainer: HTMLElement | null = null // Store container for video playback

  private async getAgora() {
    if (typeof window === "undefined") throw new Error("Agora can only be used in the browser")
    const mod = await import("agora-rtc-sdk-ng")
    // Configure for ultra-low latency audio streaming
    try { (mod.default as any).setLogLevel(3) } catch {}
    
    // Enable low-latency optimizations
    try {
      // Optimize for minimal delay
      (mod.default as any).setParameter('AUDIO_VOLUME_INDICATION_INTERVAL', 100)
    } catch {}
    
    return mod.default
  }

  private async fetchToken(channelName: string, role: AgoraJoinRole, uid?: number) {
    const res = await fetch("/api/agora/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelName, role, uid }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || "Failed to fetch Agora token")
    return data as { token: string; uid: number; appId: string }
  }

  async join(config: AgoraJoinConfig) {
    // Prevent concurrent join operations
    if (this.isJoining) {
      console.log("[Agora] Join already in progress, waiting...")
      await new Promise(resolve => setTimeout(resolve, 100))
      if (this.isJoining) {
        throw new Error("Another join operation is in progress")
      }
    }

    this.isJoining = true

    try {
      // Ensure we fully leave any existing connection first
      if (this.client) {
        console.log("[Agora] Leaving existing connection before joining new one...")
        await this.leave()
        // Add a small delay to ensure cleanup completes
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      const { channelName, role, uid } = config

      const tokenInfo = await this.fetchToken(channelName, role, uid)
      const appId = tokenInfo.appId
      const token = tokenInfo.token
      const agoraUid = tokenInfo.uid

      // Ultra-low-latency RTC mode for real-time audio streaming
      const AgoraRTC = await this.getAgora()
      this.client = AgoraRTC.createClient({ 
        mode: "rtc",  // RTC mode for minimal latency (76-200ms vs 400-800ms in live mode)
        codec: "vp8"  // VP8 is faster than H264 for web-based streaming
      })
      
      // Set low-latency mode for audio
      this.client.setLowStreamParameter({
        width: 320,
        height: 240,
        framerate: 15,
        bitrate: 140
      })

      // Store container reference for video playback (subscribers)
      this.videoContainer = config.container

      await this.client.join(appId, channelName, token, agoraUid)
      console.log("[Agora] Successfully joined channel:", channelName)

      if (role === "publisher") {
        const enableVideo = config.enableVideo ?? true // Default to video enabled
        await this.startScreenShare(config.container, { 
          enableVideo,
          withSystemAudio: true,
          fullScreen: true
        })
      } else {
        // Audience: subscribe to both audio and video tracks
        this.client.on("user-published", async (user, mediaType) => {
          console.log("[Agora] user-published:", user.uid, mediaType)
          
          // Subscribe to the track
          await this.client!.subscribe(user, mediaType)
          
          if (mediaType === "audio") {
            const remoteAudioTrack = user.audioTrack as IRemoteAudioTrack
            
            // Set audio playback with minimal buffer for lowest latency
            console.log("[Agora] Playing audio from user:", user.uid, "with low-latency mode")
            remoteAudioTrack.play()
            
            // Set volume to ensure clear audio
            remoteAudioTrack.setVolume(100)
          } else if (mediaType === "video") {
            const remoteVideoTrack = user.videoTrack as IRemoteVideoTrack
            
            // Play video in the stored container
            console.log("[Agora] Playing video from user:", user.uid)
            if (this.videoContainer) {
              remoteVideoTrack.play(this.videoContainer)
            } else {
              console.error("[Agora] No container available for video playback")
            }
          }
        })

        this.client.on("user-unpublished", async (user, mediaType) => {
          console.log("[Agora] user-unpublished:", user.uid, mediaType)
          if (mediaType === "audio" && user.audioTrack) {
            // Stop the audio track
            user.audioTrack.stop()
          } else if (mediaType === "video" && user.videoTrack) {
            // Stop the video track
            user.videoTrack.stop()
          }
        })
      }
    } finally {
      this.isJoining = false
    }
  }

  async leave() {
    console.log("[Agora] Starting leave process...")
    
    try {
      if (this.client) {
        // CRITICAL: Stop all remote users' audio tracks (for subscribers)
        const remoteUsers = this.client.remoteUsers
        console.log("[Agora] Stopping", remoteUsers.length, "remote users")
        
        for (const user of remoteUsers) {
          if (user.audioTrack) {
            console.log("[Agora] Stopping remote audio from user:", user.uid)
            user.audioTrack.stop()
          }
          if (user.videoTrack) {
            user.videoTrack.stop()
          }
        }

        // Remove all event listeners to prevent duplicates
        this.client.removeAllListeners()
        console.log("[Agora] Removed all event listeners")

        // Unpublish local tracks (for publishers)
        if (this.localAudio) {
          this.localAudio.stop()
          this.localAudio.close()
        }
        if (this.localVideo) {
          this.localVideo.stop()
          this.localVideo.close()
        }

        // Unpublish screen tracks if they exist
        if (this.screenVideoTrack || this.screenAudioTrack) {
          try {
            const tracksToUnpublish: any[] = []
            if (this.screenVideoTrack) tracksToUnpublish.push(this.screenVideoTrack)
            if (this.screenAudioTrack) tracksToUnpublish.push(this.screenAudioTrack)
            await this.client.unpublish(tracksToUnpublish)
          } catch (err) {
            console.log("[Agora] Error unpublishing screen tracks:", err)
          }
        }
        
        await this.client.unpublish().catch(() => {})
        
        // Leave the channel
        await this.client.leave()
        console.log("[Agora] Successfully left channel")
      }
      
      // Close tracks
      if (this.screenVideoTrack) {
        this.screenVideoTrack.stop()
        this.screenVideoTrack.close()
      }
      if (this.screenAudioTrack) {
        this.screenAudioTrack.stop()
        this.screenAudioTrack.close()
      }
    } catch (err) {
      console.error("[Agora] Error during leave:", err)
    } finally {
      this.client = null
      this.localAudio = null
      this.localVideo = null
      this.screenVideoTrack = null
      this.screenAudioTrack = null
      this.videoContainer = null
      console.log("[Agora] Leave cleanup complete")
    }
  }

  async startScreenShare(
    container: HTMLElement,
    options?: { fullScreen?: boolean; withSystemAudio?: boolean; preferFPS60?: boolean; enableVideo?: boolean }
  ) {
    if (!this.client) throw new Error("Client not joined")
    if (this.screenVideoTrack || this.screenAudioTrack) return

    const fullScreen = options?.fullScreen ?? true
    const withSystemAudio = options?.withSystemAudio ?? true
    const enableVideo = options?.enableVideo ?? true // Default to video enabled

    const AgoraRTC = await this.getAgora()
    
    try {
      console.log("[Agora] Creating screen share with video:", enableVideo, "and audio:", withSystemAudio)
      
      if (enableVideo) {
        // Create screen capture with both video and audio
        const screenTracks = await AgoraRTC.createScreenVideoTrack(
          {
            encoderConfig: "1080p_1",  // High quality video
            optimizationMode: "motion" as const,  // Better for screen sharing with motion
            screenSourceType: fullScreen ? ("screen" as const) : ("window" as const),
          },
          withSystemAudio ? "auto" : "disable"
        )
        
        if (Array.isArray(screenTracks)) {
          // We got both video and audio tracks
          this.screenVideoTrack = screenTracks[0]
          this.screenAudioTrack = screenTracks[1]
          
          console.log("[Agora] Got both video and audio tracks")
          
          // Configure audio track for high quality
          try {
            (this.screenAudioTrack as any).setAudioEncoderConfiguration({
              sampleRate: 48000,
              stereo: true,
              bitrate: 128
            })
          } catch (configError) {
            console.log("[Agora] Note: Audio config not fully supported, using defaults")
          }
          
          // Play video in container
          this.screenVideoTrack.play(container)
          
          // Publish both video and audio tracks
          await this.client.publish([this.screenVideoTrack, this.screenAudioTrack] as any)
          
          console.log("[Agora] Published video and audio tracks successfully")
        } else {
          // Only got video track (no system audio)
          this.screenVideoTrack = screenTracks
          this.screenVideoTrack.play(container)
          
          // Create microphone audio track
          this.localAudio = await AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: {
              sampleRate: 48000,
              stereo: true,
              bitrate: 128
            },
            AEC: true,
            AGC: true,
            ANS: true
          })
          
          await this.client.publish([this.screenVideoTrack, this.localAudio] as any)
          console.log("[Agora] Published video and microphone audio tracks")
        }
      } else {
        // Audio-only mode: create screen share with audio but don't publish video
        const screenTracks = await AgoraRTC.createScreenVideoTrack(
          {
            encoderConfig: "480p_1",  // Low quality since we won't publish video
            optimizationMode: "detail" as const,
            screenSourceType: fullScreen ? ("screen" as const) : ("window" as const),
          },
          withSystemAudio ? "auto" : "disable"
        )
        
        if (Array.isArray(screenTracks)) {
          // We got both video and audio tracks, but only use audio
          this.screenVideoTrack = screenTracks[0]
          this.screenAudioTrack = screenTracks[1]
          
          // Close video track immediately (we don't need it)
          this.screenVideoTrack.stop()
          this.screenVideoTrack.close()
          this.screenVideoTrack = null
          
          // Configure and publish only audio
          try {
            (this.screenAudioTrack as any).setAudioEncoderConfiguration({
              sampleRate: 48000,
              stereo: true,
              bitrate: 128
            })
          } catch (configError) {
            console.log("[Agora] Note: Audio config not fully supported, using defaults")
          }
          
          await this.client.publish([this.screenAudioTrack] as any)
          console.log("[Agora] Published audio-only track successfully")
        } else {
          // Only got video track, create microphone audio
          this.screenVideoTrack = screenTracks
          this.screenVideoTrack.stop()
          this.screenVideoTrack.close()
          this.screenVideoTrack = null
          
          this.localAudio = await AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: {
              sampleRate: 48000,
              stereo: true,
              bitrate: 128
            },
            AEC: true,
            AGC: true,
            ANS: true
          })
          await this.client.publish([this.localAudio] as any)
          console.log("[Agora] Published microphone audio track (audio-only mode)")
        }
      }
    } catch (error) {
      console.error("[Agora] Screen share failed:", error)
      // Fallback: create high-quality microphone track
      try {
        console.log("[Agora] Using high-quality microphone as audio fallback...")
        this.localAudio = await AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: {
            sampleRate: 48000,
            stereo: true,
            bitrate: 128
          },
          AEC: true,
          AGC: true,
          ANS: true
        })
        await this.client.publish([this.localAudio] as any)
      } catch (fallbackError) {
        console.error("[Agora] Fallback failed:", fallbackError)
        throw error
      }
    }
  }
  

  async stopScreenShare() {
    if (!this.client) return
    
    try {
      // Unpublish both video and audio tracks
      const tracksToUnpublish: any[] = []
      if (this.screenVideoTrack) tracksToUnpublish.push(this.screenVideoTrack)
      if (this.screenAudioTrack) tracksToUnpublish.push(this.screenAudioTrack)
      
      if (tracksToUnpublish.length > 0) {
        await this.client.unpublish(tracksToUnpublish)
      }
    } catch (e) {
      console.error("[Agora] Error unpublishing screen tracks:", e)
    }
    
    try {
      // Stop and close audio track
      if (this.screenAudioTrack) {
        this.screenAudioTrack.stop()
        this.screenAudioTrack.close()
        this.screenAudioTrack = null
      }
    } catch (e) {
      console.error("[Agora] Error stopping screen audio:", e)
    }
    
    try {
      // Stop and close video track
      if (this.screenVideoTrack) {
        this.screenVideoTrack.stop()
        this.screenVideoTrack.close()
        this.screenVideoTrack = null
      }
    } catch (e) {
      console.error("[Agora] Error closing screen video:", e)
    }
  }
  
  async enableVideo() {
    if (!this.client) throw new Error("Client not joined")
    // Note: Video is enabled when screen share starts, but you can add logic here to enable video mid-stream if needed
    throw new Error("Video must be enabled when starting screen share")
  }

  async disableVideo() {
    if (!this.client || !this.screenVideoTrack) return
    try {
      await this.client.unpublish([this.screenVideoTrack])
      this.screenVideoTrack.stop()
      this.screenVideoTrack.close()
      this.screenVideoTrack = null
      console.log("[Agora] Video disabled successfully")
    } catch (e) {
      console.error("[Agora] Error disabling video:", e)
    }
  }

  async enableMic() {
    if (!this.client) throw new Error("Client not joined")
    if (!this.localAudio) {
      const AgoraRTC = await this.getAgora()
      // Create high-quality microphone track
      this.localAudio = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: {
          sampleRate: 48000,  // 48kHz for high quality
          stereo: true,        // Stereo audio
          bitrate: 128         // 128kbps
        },
        AEC: true,             // Echo cancellation
        AGC: true,             // Auto gain control
        ANS: true              // Noise suppression
      })
      await this.client.publish([this.localAudio] as any)
    } else {
      await this.localAudio.setEnabled(true)
      // Ensure published
      try {
        await this.client.publish([this.localAudio] as any)
      } catch {}
    }
  }

  async disableMic() {
    if (!this.client || !this.localAudio) return
    try {
      await this.localAudio.setEnabled(false)
      await this.client.unpublish([this.localAudio] as any)
    } catch {}
  }

  hasVideoTrack(): boolean {
    if (!this.client) return false
    const remoteUsers = this.client.remoteUsers
    return remoteUsers.some(user => user.videoTrack && user.hasVideo)
  }

  getRemoteVideoTrack() {
    if (!this.client) return null
    const remoteUsers = this.client.remoteUsers
    const userWithVideo = remoteUsers.find(user => user.videoTrack && user.hasVideo)
    return userWithVideo?.videoTrack || null
  }
}

export const agoraManager = new AgoraManager()


