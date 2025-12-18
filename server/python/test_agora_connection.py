#!/usr/bin/env python3
"""
Simple Agora connection test script.
Run from terminal with your credentials to test if the SDK can connect.

Usage:
  python server/python/test_agora_connection.py --appId YOUR_APP_ID --channelId YOUR_CHANNEL --userId 12345 --token YOUR_TOKEN

If you don't have a token (testing mode), omit --token:
  python server/python/test_agora_connection.py --appId YOUR_APP_ID --channelId YOUR_CHANNEL --userId 12345
"""

import argparse
import time
import os
import sys

print("=" * 60)
print("Agora Python Server SDK Connection Test")
print("=" * 60)

# Parse arguments
parser = argparse.ArgumentParser(description='Test Agora connection')
parser.add_argument('--appId', required=True, help='Agora App ID')
parser.add_argument('--channelId', required=True, help='Channel name to join')
parser.add_argument('--userId', type=str, required=True, help='User ID (string)')
parser.add_argument('--token', default='', help='Agora token (optional)')
args = parser.parse_args()

print(f"\nConfiguration:")
print(f"  App ID: {args.appId[:8]}...{args.appId[-4:] if len(args.appId) > 12 else args.appId}")
print(f"  Channel: {args.channelId}")
print(f"  User ID: {args.userId}")
print(f"  Token: {'[provided]' if args.token else '[empty]'}")
print()

# Import SDK
print("Importing Agora SDK...")
try:
    from agora.rtc.agora_service import AgoraService, AgoraServiceConfig
    from agora.rtc.rtc_connection import RTCConnection, RTCConnConfig
    from agora.rtc.rtc_connection_observer import IRTCConnectionObserver
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
    print("  SDK imported successfully!")
except ImportError as e:
    print(f"  ERROR: Failed to import SDK: {e}")
    sys.exit(1)

# Connection observer
class TestConnectionObserver(IRTCConnectionObserver):
    def __init__(self):
        super().__init__()
        self.connected = False
        self.error = None
        
    def on_connected(self, agora_rtc_conn, conn_info, reason):
        print(f"  [CONNECTED] channel={conn_info.channel_id}, local_user_id={conn_info.local_user_id}")
        self.connected = True
        
    def on_disconnected(self, agora_rtc_conn, conn_info, reason):
        print(f"  [DISCONNECTED] reason={reason}")
        self.connected = False
        
    def on_connecting(self, agora_rtc_conn, conn_info, reason):
        print(f"  [CONNECTING]...")
    
    def on_connection_failure(self, agora_rtc_conn, conn_info, reason):
        print(f"  [CONNECTION FAILURE] reason={reason}")
        self.error = reason
    
    def on_reconnecting(self, agora_rtc_conn, conn_info, reason):
        print(f"  [RECONNECTING] reason={reason}")
    
    def on_reconnected(self, agora_rtc_conn, conn_info, reason):
        print(f"  [RECONNECTED]")
        self.connected = True
        
    def on_user_joined(self, agora_rtc_conn, user_id):
        print(f"  [USER JOINED] user_id={user_id}")
        
    def on_user_left(self, agora_rtc_conn, user_id, reason):
        print(f"  [USER LEFT] user_id={user_id}")


# Create log directory
log_dir = "./agora_rtc_log"
os.makedirs(log_dir, exist_ok=True)

# Initialize service
print("\nStep 1: Initializing AgoraService...")
try:
    config = AgoraServiceConfig()
    config.appid = args.appId
    config.log_path = f"{log_dir}/agorasdk.log"
    config.log_file_size_kb = 1024
    config.data_dir = log_dir
    config.config_dir = log_dir
    
    service = AgoraService()
    result = service.initialize(config)
    
    if result != 0:
        print(f"  ERROR: initialize() returned {result}")
        sys.exit(1)
    print("  AgoraService initialized successfully!")
except Exception as e:
    print(f"  ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Create connection config
print("\nStep 2: Creating connection configuration...")
try:
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
            number_of_channels=1,
            sample_rate_hz=16000
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
    print("  Configuration created!")
except Exception as e:
    print(f"  ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Create connection
print("\nStep 3: Creating RTC connection...")
try:
    connection = service.create_rtc_connection(conn_config, publish_config)
    if not connection:
        print("  ERROR: create_rtc_connection() returned None")
        sys.exit(1)
    print("  RTC connection created!")
except Exception as e:
    print(f"  ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Register observer
print("\nStep 4: Registering connection observer...")
observer = TestConnectionObserver()
connection.register_observer(observer)
print("  Observer registered!")

# Connect
print("\nStep 5: Connecting to channel...")
try:
    result = connection.connect(args.token, args.channelId, args.userId)
    print(f"  connect() returned: {result}")
    
    if result != 0:
        error_desc = {
            -2: "ERR_INVALID_ARGUMENT - check App ID, token, or channel name",
            -7: "ERR_NOT_INITIALIZED - SDK not properly initialized",
            110: "ERR_INVALID_TOKEN - token is invalid or expired",
        }
        print(f"  ERROR: {error_desc.get(result, 'Unknown error code')}")
        connection.release()
        service.release()
        sys.exit(1)
except Exception as e:
    print(f"  ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Wait for connection
print("\nStep 6: Waiting for connection callback (up to 30 seconds)...")
timeout = 30
start_time = time.time()
while time.time() - start_time < timeout:
    if observer.connected:
        print("\n" + "=" * 60)
        print("SUCCESS! Connected to Agora channel!")
        print("=" * 60)
        print(f"\nStaying connected for 5 seconds to verify stability...")
        time.sleep(5)
        break
    if observer.error is not None:
        print(f"\n  Connection failed with error: {observer.error}")
        break
    time.sleep(0.1)
else:
    print("\n  TIMEOUT: Did not receive connection callback in 30 seconds")

# Cleanup
print("\nStep 7: Cleaning up...")
try:
    connection.disconnect()
    connection.release()
    service.release()
    print("  Cleanup complete!")
except Exception as e:
    print(f"  Cleanup error: {e}")

print("\n" + "=" * 60)
if observer.connected:
    print("TEST RESULT: SUCCESS")
else:
    print("TEST RESULT: FAILED")
    print("\nCheck the log file for more details:")
    print(f"  {log_dir}/agorasdk.log")
print("=" * 60)
