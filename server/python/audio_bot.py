#!/usr/bin/env python3
"""
Agora Audio Bot - Server-side audio playback for voice channels.
Based on official Agora Python Server SDK v2.4.0 examples.
"""

import sys
import json
import time
import asyncio
import threading
import traceback
import os
from typing import Optional

_original_stdout = sys.stdout
_stdout_lock = threading.Lock()

class StderrRedirector:
    def write(self, text):
        sys.stderr.write(text)
    def flush(self):
        sys.stderr.flush()

sys.stdout = StderrRedirector()

PYDUB_AVAILABLE = False
PYDUB_IMPORT_ERROR = ""
AGORA_SDK_AVAILABLE = False
AGORA_IMPORT_ERROR = ""

try:
    from pydub import AudioSegment
    PYDUB_AVAILABLE = True
except ImportError as e:
    PYDUB_IMPORT_ERROR = str(e)

try:
    from agora.rtc.agora_service import AgoraService, AgoraServiceConfig
    from agora.rtc.rtc_connection import RTCConnection, RTCConnConfig
    from agora.rtc.rtc_connection_observer import IRTCConnectionObserver
    from agora.rtc.local_user_observer import IRTCLocalUserObserver
    from agora.rtc.agora_base import (
        AudioScenarioType,
        AudioProfileType,
        AudioPublishType,
        VideoPublishType,
        ChannelProfileType,
        ClientRoleType,
        AudioSubscriptionOptions,
        RtcConnectionPublishConfig,
    )
    AGORA_SDK_AVAILABLE = True
except ImportError as e:
    AGORA_IMPORT_ERROR = str(e)

def send_json(msg: dict):
    """Send JSON message to original stdout for Node.js to receive, thread-safe."""
    with _stdout_lock:
        try:
            _original_stdout.write(json.dumps(msg) + "\n")
            _original_stdout.flush()
        except Exception as e:
            sys.stderr.write(f"Error sending message: {e}\n")
            sys.stderr.flush()

SDK_AVAILABLE = AGORA_SDK_AVAILABLE and PYDUB_AVAILABLE
SDK_ERROR = AGORA_IMPORT_ERROR or PYDUB_IMPORT_ERROR

SAMPLE_RATE = 16000
NUM_CHANNELS = 1


class LocalUserObserver(IRTCLocalUserObserver):
    """Observer for local user events - matches official ExampleLocalUserObserver."""
    
    def __init__(self, bot):
        super().__init__()
        self.bot = bot
    
    def on_stream_message(self, agora_local_user, user_id, stream_id, data, length):
        self.bot.log(f"Stream message from {user_id}", "info")
    
    def on_audio_publish_state_changed(self, agora_local_user, channel, old_state, new_state, elapse_since_last_state):
        self.bot.log(f"Audio publish state changed: {old_state} -> {new_state}", "info")


class ConnectionObserver(IRTCConnectionObserver):
    """Observer for connection state changes - matches official ExampleConnectionObserver."""
    
    def __init__(self, bot):
        super().__init__()
        self.bot = bot
        
    def on_connected(self, agora_rtc_conn, conn_info, reason):
        self.bot.log(f"Connected! channel={conn_info.channel_id}, local_user_id={conn_info.local_user_id}", "success")
        self.bot.is_connected = True
        
    def on_disconnected(self, agora_rtc_conn, conn_info, reason):
        self.bot.log(f"Disconnected: reason={reason}", "warning")
        self.bot.is_connected = False
        
    def on_connecting(self, agora_rtc_conn, conn_info, reason):
        self.bot.log(f"Connecting to channel...", "info")
    
    def on_connection_failure(self, agora_rtc_conn, conn_info, reason):
        self.bot.log(f"Connection failure: reason={reason}", "error")
    
    def on_reconnecting(self, agora_rtc_conn, conn_info, reason):
        self.bot.log(f"Reconnecting: reason={reason}", "warning")
    
    def on_reconnected(self, agora_rtc_conn, conn_info, reason):
        self.bot.log(f"Reconnected", "success")
        self.bot.is_connected = True
        
    def on_user_joined(self, agora_rtc_conn, user_id):
        self.bot.log(f"User joined: {user_id}", "info")
        
    def on_user_left(self, agora_rtc_conn, user_id, reason):
        self.bot.log(f"User left: {user_id}", "info")


class AudioBot:
    """Audio bot that joins Agora channels and streams audio."""
    
    def __init__(self):
        self.service: Optional[AgoraService] = None
        self.connection: Optional[RTCConnection] = None
        self.conn_observer: Optional[ConnectionObserver] = None
        self.local_user_observer: Optional[LocalUserObserver] = None
        self.is_connected = False
        self.is_playing = False
        self.should_stop = False
        self.current_file: Optional[str] = None
        self.playback_thread: Optional[threading.Thread] = None
        self.app_id: Optional[str] = None
        self.channel: Optional[str] = None
        self.uid: Optional[str] = None
        self.playback_progress = 0
        self.playback_duration = 0
        
    def log(self, message: str, level: str = "info"):
        """Send log message to Node.js process."""
        self._send_message({
            "type": "log",
            "level": level,
            "message": message,
            "timestamp": time.time()
        })
        
    def _send_message(self, msg: dict):
        """Send JSON message to stdout for Node.js to receive."""
        send_json(msg)
    
    def initialize(self, app_id: str) -> bool:
        """Initialize the Agora service - matches official pattern."""
        if not AGORA_SDK_AVAILABLE:
            self.log(f"Agora SDK not available: {AGORA_IMPORT_ERROR}", "error")
            return False
            
        try:
            self.app_id = app_id
            
            log_dir = "./agora_rtc_log"
            if not os.path.exists(log_dir):
                os.makedirs(log_dir, exist_ok=True)
            
            config = AgoraServiceConfig()
            config.appid = app_id
            config.log_path = f"{log_dir}/agorasdk.log"
            config.log_file_size_kb = 1024
            config.data_dir = log_dir
            config.config_dir = log_dir
            
            self.service = AgoraService()
            result = self.service.initialize(config)
            
            if result != 0:
                self.log(f"Failed to initialize Agora service: error code {result}", "error")
                return False
                
            self.log("Agora service initialized successfully", "info")
            return True
            
        except Exception as e:
            self.log(f"Error initializing Agora service: {e}", "error")
            traceback.print_exc(file=sys.stderr)
            return False
    
    def join_channel(self, channel: str, uid: str, token: str = "") -> bool:
        """Join an Agora voice channel - matches official example_base.py pattern exactly."""
        if not self.service:
            self.log("Service not initialized", "error")
            return False
            
        try:
            self.channel = channel
            self.uid = uid
            
            conn_config = RTCConnConfig(
                client_role_type=ClientRoleType.CLIENT_ROLE_BROADCASTER,
                channel_profile=ChannelProfileType.CHANNEL_PROFILE_LIVE_BROADCASTING,
                auto_subscribe_audio=1,
                auto_subscribe_video=0,
                audio_recv_media_packet=0,
                audio_subs_options=AudioSubscriptionOptions(
                    packet_only=0,
                    pcm_data_only=1,
                    bytes_per_sample=2,
                    number_of_channels=NUM_CHANNELS,
                    sample_rate_hz=SAMPLE_RATE
                )
            )
            
            publish_config = RtcConnectionPublishConfig(
                audio_profile=AudioProfileType.AUDIO_PROFILE_DEFAULT,
                audio_scenario=AudioScenarioType.AUDIO_SCENARIO_AI_SERVER,
                is_publish_audio=True,
                is_publish_video=False,
                audio_publish_type=AudioPublishType.AUDIO_PUBLISH_TYPE_PCM,
                video_publish_type=VideoPublishType.VIDEO_PUBLISH_TYPE_NONE,
            )
            
            self.connection = self.service.create_rtc_connection(conn_config, publish_config)
            
            if not self.connection:
                self.log("Failed to create RTC connection", "error")
                return False
            
            self.conn_observer = ConnectionObserver(self)
            self.connection.register_observer(self.conn_observer)
            
            self.log(f"Connecting to channel '{channel}' with UID='{uid}', token={'[provided]' if token else '[empty]'}...", "info")
            
            self.connection.connect(token, channel, uid)
            
            local_user = self.connection.get_local_user()
            self.local_user_observer = LocalUserObserver(self)
            self.connection.register_local_user_observer(self.local_user_observer)
            
            self.is_connected = True
            self.log(f"Join initiated for channel '{channel}' with UID '{uid}'", "success")
            
            self._send_message({
                "type": "status",
                "status": "connected",
                "channel": channel,
                "uid": uid
            })
            
            return True
            
        except Exception as e:
            self.log(f"Error joining channel: {e}", "error")
            traceback.print_exc(file=sys.stderr)
            return False
    
    def leave_channel(self):
        """Leave the current channel."""
        try:
            if self.is_playing:
                self.stop_playback()
                
            if self.connection:
                self.connection.disconnect()
                self.connection.release()
                self.connection = None
            
            self.conn_observer = None
            self.local_user_observer = None
            self.is_connected = False
            self.log("Left channel", "info")
            
            self._send_message({
                "type": "status",
                "status": "disconnected"
            })
            
        except Exception as e:
            self.log(f"Error leaving channel: {e}", "error")
    
    def convert_audio_to_pcm(self, file_path: str) -> Optional[bytes]:
        """Convert audio file to PCM format."""
        try:
            self.log(f"Loading audio file: {file_path}", "info")
            
            if file_path.lower().endswith('.mp3'):
                audio = AudioSegment.from_mp3(file_path)
            elif file_path.lower().endswith('.wav'):
                audio = AudioSegment.from_wav(file_path)
            elif file_path.lower().endswith('.ogg'):
                audio = AudioSegment.from_ogg(file_path)
            else:
                audio = AudioSegment.from_file(file_path)
            
            audio = audio.set_frame_rate(SAMPLE_RATE)
            audio = audio.set_channels(NUM_CHANNELS)
            audio = audio.set_sample_width(2)
            
            self.playback_duration = len(audio)
            self.log(f"Audio loaded: {self.playback_duration}ms duration, {len(audio.raw_data)} bytes", "info")
            
            return audio.raw_data
            
        except Exception as e:
            self.log(f"Error converting audio: {e}", "error")
            traceback.print_exc(file=sys.stderr)
            return None
    
    def _playback_loop(self, pcm_data: bytes):
        """Stream PCM data - matches official push_pcm_data_from_file pattern exactly."""
        try:
            pcm_send_interval = 5
            send_size = int(SAMPLE_RATE * NUM_CHANNELS * pcm_send_interval * 2)
            interval = 0.06
            bytes_per_ms = int(SAMPLE_RATE * NUM_CHANNELS * 2 / 1000)
            
            total_bytes = len(pcm_data)
            bytes_sent = 0
            
            self.log(f"Starting playback: {total_bytes} bytes", "info")
            
            while bytes_sent < total_bytes and not self.should_stop:
                if not self.connection:
                    self.log("Connection lost during playback", "error")
                    break
                
                try:
                    is_completed = self.connection.is_push_to_rtc_completed()
                except Exception as e:
                    self.log(f"Error checking push status: {e}", "warning")
                    is_completed = True
                
                if is_completed:
                    remaining = total_bytes - bytes_sent
                    read_len = min(send_size, remaining)
                    
                    if read_len < bytes_per_ms * 100:
                        break
                    
                    read_len = int(read_len // bytes_per_ms) * bytes_per_ms
                    
                    frame_buf = bytearray(pcm_data[bytes_sent:bytes_sent + read_len])
                    mv = memoryview(frame_buf)
                    slice_data = mv[:read_len]
                    
                    try:
                        self.connection.push_audio_pcm_data(slice_data, SAMPLE_RATE, NUM_CHANNELS)
                        bytes_sent += read_len
                        
                        percent = int((bytes_sent / total_bytes) * 100)
                        self.playback_progress = int((bytes_sent / total_bytes) * self.playback_duration)
                        
                        self._send_message({
                            "type": "progress",
                            "current": self.playback_progress,
                            "total": self.playback_duration,
                            "percent": percent
                        })
                        
                        self.log(f"Sent {percent}% ({bytes_sent}/{total_bytes} bytes)", "info")
                        
                    except Exception as e:
                        self.log(f"Error pushing audio data: {e}", "error")
                        break
                
                time.sleep(interval)
            
            while not self.should_stop:
                try:
                    if self.connection and self.connection.is_push_to_rtc_completed():
                        break
                except:
                    break
                time.sleep(0.1)
            
            if not self.should_stop:
                self.log("Playback completed", "success")
                self._send_message({
                    "type": "playback_complete",
                    "file": self.current_file
                })
            else:
                self.log("Playback stopped", "info")
                self._send_message({
                    "type": "playback_stopped",
                    "file": self.current_file
                })
                
        except Exception as e:
            self.log(f"Error in playback loop: {e}", "error")
            traceback.print_exc(file=sys.stderr)
        finally:
            self.is_playing = False
            self.should_stop = False
            self.current_file = None
            self.playback_progress = 0
    
    def play_audio(self, file_path: str) -> bool:
        """Start playing an audio file."""
        if not self.is_connected:
            self.log("Not connected to a channel", "error")
            return False
            
        if self.is_playing:
            self.log("Already playing audio, stopping current playback", "warning")
            self.stop_playback()
            time.sleep(0.5)
        
        try:
            pcm_data = self.convert_audio_to_pcm(file_path)
            
            if not pcm_data:
                self.log("Failed to convert audio file", "error")
                return False
            
            self.current_file = file_path
            self.is_playing = True
            self.should_stop = False
            
            self._send_message({
                "type": "playback_started",
                "file": file_path,
                "duration": self.playback_duration
            })
            
            self.playback_thread = threading.Thread(
                target=self._playback_loop,
                args=(pcm_data,)
            )
            self.playback_thread.daemon = True
            self.playback_thread.start()
            
            return True
            
        except Exception as e:
            self.log(f"Error starting playback: {e}", "error")
            self.is_playing = False
            return False
    
    def stop_playback(self):
        """Stop current audio playback."""
        if self.is_playing:
            self.should_stop = True
            if self.playback_thread:
                self.playback_thread.join(timeout=2)
            self.log("Playback stopped", "info")
    
    def get_status(self) -> dict:
        """Get current bot status."""
        return {
            "type": "status_response",
            "is_connected": self.is_connected,
            "is_playing": self.is_playing,
            "channel": self.channel,
            "uid": self.uid,
            "current_file": self.current_file,
            "playback_progress": self.playback_progress,
            "playback_duration": self.playback_duration
        }
    
    def cleanup(self):
        """Clean up resources."""
        try:
            self.stop_playback()
            self.leave_channel()
            
            if self.service:
                self.service.release()
                self.service = None
                
            self.log("Cleanup complete", "info")
            
        except Exception as e:
            self.log(f"Error during cleanup: {e}", "error")


def main():
    """Main entry point - handles IPC with Node.js."""
    bot = AudioBot()
    
    ready_msg = {
        "type": "ready",
        "sdk_available": SDK_AVAILABLE,
        "agora_available": AGORA_SDK_AVAILABLE,
        "pydub_available": PYDUB_AVAILABLE,
    }
    if not SDK_AVAILABLE:
        ready_msg["error"] = SDK_ERROR
    send_json(ready_msg)
    
    try:
        for line in sys.stdin:
            try:
                line = line.strip()
                if not line:
                    continue
                    
                msg = json.loads(line)
                cmd = msg.get("command", "")
                
                if cmd == "init":
                    app_id = msg.get("appId", "")
                    success = bot.initialize(app_id)
                    send_json({
                        "type": "init_response",
                        "success": success
                    })
                    
                elif cmd == "join":
                    channel = msg.get("channel", "")
                    uid = str(msg.get("uid", ""))
                    token = msg.get("token", "")
                    success = bot.join_channel(channel, uid, token)
                    send_json({
                        "type": "join_response",
                        "success": success
                    })
                    
                elif cmd == "leave":
                    bot.leave_channel()
                    send_json({
                        "type": "leave_response",
                        "success": True
                    })
                    
                elif cmd == "play":
                    file_path = msg.get("file", "")
                    success = bot.play_audio(file_path)
                    send_json({
                        "type": "play_response",
                        "success": success
                    })
                    
                elif cmd == "stop":
                    bot.stop_playback()
                    send_json({
                        "type": "stop_response",
                        "success": True
                    })
                    
                elif cmd == "status":
                    status = bot.get_status()
                    send_json(status)
                    
                elif cmd == "quit":
                    bot.cleanup()
                    send_json({
                        "type": "quit_response",
                        "success": True
                    })
                    break
                    
                else:
                    send_json({
                        "type": "error",
                        "message": f"Unknown command: {cmd}"
                    })
                    
            except json.JSONDecodeError as e:
                send_json({
                    "type": "error",
                    "message": f"Invalid JSON: {e}"
                })
            except Exception as e:
                send_json({
                    "type": "error",
                    "message": str(e)
                })
                traceback.print_exc(file=sys.stderr)
                
    except KeyboardInterrupt:
        pass
    finally:
        bot.cleanup()


if __name__ == "__main__":
    main()
