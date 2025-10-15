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
}

export class AgoraManager {
  private client: IAgoraRTCClient | null = null
  private localAudio: ILocalAudioTrack | null = null
  private localVideo: ILocalVideoTrack | null = null
  private screenVideoTrack: ILocalVideoTrack | null = null
  private screenAudioTrack: ILocalAudioTrack | null = null
  private isJoining: boolean = false

  private async getAgora() {
    if (typeof window === "undefined") throw new Error("Agora can only be used in the browser")
    const mod = await import("agora-rtc-sdk-ng")
    // Configure codec and profile for smoother high-FPS screen share
    try { (mod.default as any).setLogLevel(3) } catch {}
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

      // Low-latency live mode
      const AgoraRTC = await this.getAgora()
      this.client = AgoraRTC.createClient({ mode: "live", codec: "h264" })
      this.client.setClientRole(role === "publisher" ? "host" : "audience")

      await this.client.join(appId, channelName, token, agoraUid)
      console.log("[Agora] Successfully joined channel:", channelName)

      if (role === "publisher") {
        await this.startScreenShare(config.container)
      } else {
        // Audience: subscribe only to audio tracks (audio-only mode)
        this.client.on("user-published", async (user, mediaType) => {
          console.log("[Agora] user-published:", user.uid, mediaType)
          if (mediaType === "audio") {
            await this.client!.subscribe(user, mediaType)
            const remoteAudioTrack = user.audioTrack as IRemoteAudioTrack
            console.log("[Agora] Playing audio from user:", user.uid)
            remoteAudioTrack.play()
          }
          // Skip video tracks - subscribers only hear audio
        })

        this.client.on("user-unpublished", async (user, mediaType) => {
          console.log("[Agora] user-unpublished:", user.uid, mediaType)
          if (mediaType === "audio" && user.audioTrack) {
            // Stop the audio track
            user.audioTrack.stop()
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
      console.log("[Agora] Leave cleanup complete")
    }
  }

  async startScreenShare(
    container: HTMLElement,
    options?: { fullScreen?: boolean; withSystemAudio?: boolean; preferFPS60?: boolean }
  ) {
    if (!this.client) throw new Error("Client not joined")
    if (this.screenVideoTrack || this.screenAudioTrack) return

    const fullScreen = options?.fullScreen ?? true
    const withSystemAudio = options?.withSystemAudio ?? true

    const AgoraRTC = await this.getAgora()
    
    try {
      console.log("[Agora] Creating screen share with audio...")
      
      // Create screen capture with audio
      const screenTracks = await AgoraRTC.createScreenVideoTrack(
        {
          encoderConfig: "1080p_30",
          optimizationMode: "motion" as const,
          screenSourceType: fullScreen ? ("screen" as const) : ("window" as const),
        },
        withSystemAudio ? "auto" : "disable"
      )
      
      if (Array.isArray(screenTracks)) {
        // We got both video and audio tracks
        this.screenVideoTrack = screenTracks[0]
        this.screenAudioTrack = screenTracks[1]
        
        console.log("[Agora] Got both video and audio tracks")
        console.log("[Agora] Publishing ONLY audio track...")
        
        // CRITICAL: Publish ONLY the audio track (this is what worked originally!)
        await this.client.publish([this.screenAudioTrack] as any)
        
        console.log("[Agora] Audio track published successfully")
      } else {
        // Only got video track
        this.screenVideoTrack = screenTracks
        console.log("[Agora] Only got video track, trying microphone as fallback...")
        // For audio-only mode, we'll create a microphone track to capture system audio
        this.localAudio = await AgoraRTC.createMicrophoneAudioTrack()
        await this.client.publish([this.localAudio] as any)
      }
    } catch (error) {
      console.error("[Agora] Screen share failed:", error)
      // Fallback: create microphone track for system audio
      try {
        console.log("[Agora] Using microphone as audio fallback...")
        this.localAudio = await AgoraRTC.createMicrophoneAudioTrack()
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
      // Unpublish audio track
      if (this.screenAudioTrack) {
        await this.client.unpublish([this.screenAudioTrack])
        this.screenAudioTrack.stop()
        this.screenAudioTrack.close()
        this.screenAudioTrack = null
      }
    } catch (e) {
      console.error("[Agora] Error stopping screen audio:", e)
    }
    
    try {
      // Close video track (wasn't published)
      if (this.screenVideoTrack) {
        this.screenVideoTrack.stop()
        this.screenVideoTrack.close()
        this.screenVideoTrack = null
      }
    } catch (e) {
      console.error("[Agora] Error closing screen video:", e)
    }
  }

  async enableMic() {
    if (!this.client) throw new Error("Client not joined")
    if (!this.localAudio) {
      const AgoraRTC = await this.getAgora()
      this.localAudio = await AgoraRTC.createMicrophoneAudioTrack()
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
}

export const agoraManager = new AgoraManager()


