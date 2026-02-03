#!/usr/bin/env python3
"""
Whispr Flow - Linux Clipboard Receiver for Chromebook
Receives text via WebSocket, copies to clipboard
"""

import asyncio
import json
import subprocess
import os
import signal
import sys
import logging
import logging.handlers
from pathlib import Path
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
import socketserver
import threading

# WebSocket
try:
    import websockets
    from websockets.server import WebSocketServerProtocol
except ImportError:
    print("ERROR: websockets not installed. Run: pip3 install websockets")
    sys.exit(1)

# Configuration
WS_PORT = 3002
HTTP_PORT = 3005
CONNECTED_CLIENTS = set()

# Setup logging directory
LOG_DIR = Path.home() / '.local' / 'share' / 'whispr-flow'
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / 'receiver.log'

# Determine if running in debug mode (show output) or silent mode
DEBUG_MODE = '--debug' in sys.argv or '-d' in sys.argv

# Setup logging with rotation (max 5MB, keep 3 backups)
MAX_LOG_SIZE = 5 * 1024 * 1024  # 5MB
MAX_BACKUPS = 3

# Create formatter
formatter = logging.Formatter('%(asctime)s - %(message)s', datefmt='%Y-%m-%d %H:%M:%S')

# Rotating file handler (always active)
file_handler = logging.handlers.RotatingFileHandler(
    LOG_FILE, 
    maxBytes=MAX_LOG_SIZE,
    backupCount=MAX_BACKUPS
)
file_handler.setFormatter(formatter)

# Setup logger
handlers = [file_handler]
if DEBUG_MODE:
    # Also log to console in debug mode
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    handlers.append(console_handler)

logging.basicConfig(
    level=logging.INFO,
    handlers=handlers
)

logger = logging.getLogger(__name__)

# Get IP address
def get_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

IP_ADDRESS = get_ip()

# Copy text to clipboard using xclip
def copy_to_clipboard(text):
    try:
        process = subprocess.Popen(['xclip', '-selection', 'clipboard'], 
                                   stdin=subprocess.PIPE, 
                                   close_fds=True)
        process.communicate(input=text.encode('utf-8'))
        if process.returncode == 0:
            return True
    except:
        pass
    
    try:
        process = subprocess.Popen(['wl-copy'], 
                                   stdin=subprocess.PIPE, 
                                   close_fds=True)
        process.communicate(input=text.encode('utf-8'))
        if process.returncode == 0:
            return True
    except:
        pass
    
    try:
        process = subprocess.Popen(['xsel', '--clipboard', '--input'], 
                                   stdin=subprocess.PIPE, 
                                   close_fds=True)
        process.communicate(input=text.encode('utf-8'))
        return process.returncode == 0
    except:
        pass
    
    return False

# WebSocket handler
async def websocket_handler(websocket: WebSocketServerProtocol, path):
    client_ip = websocket.remote_address[0]
    logger.info(f"📱 iPhone connected from {client_ip}")
    CONNECTED_CLIENTS.add(websocket)
    
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                text = None

                # Handle existing format: type == "transcription" with text at top level
                if data.get('type') == 'transcription' and data.get('text'):
                    text = data['text']
                # Handle iPhone format: event == "paste_text" with text nested in data.text
                elif data.get('event') == 'paste_text' and data.get('data'):
                    event_data = data['data']
                    if isinstance(event_data, dict) and event_data.get('text'):
                        text = event_data['text']

                if text:
                    preview = text[:50] + ('...' if len(text) > 50 else '')
                    logger.info(f"🎤 Received: {preview}")

                    if copy_to_clipboard(text):
                        logger.info(f"✅ Copied to clipboard!")
                        await websocket.send(json.dumps({
                            'status': 'ok',
                            'message': 'Copied to clipboard'
                        }))
                    else:
                        logger.error(f"❌ Failed to copy to clipboard")
                        await websocket.send(json.dumps({
                            'status': 'error',
                            'message': 'Clipboard copy failed'
                        }))
            except json.JSONDecodeError:
                logger.error(f"❌ Invalid JSON received")
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"📱 iPhone disconnected")
    finally:
        CONNECTED_CLIENTS.discard(websocket)

# Custom HTTP handler
class StatusHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent), **kwargs)
    
    def do_GET(self):
        if self.path == '/ip':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'ip': IP_ADDRESS}).encode())
        elif self.path == '/':
            self.path = '/web-clipboard-receiver.html'
            return super().do_GET()
        elif self.path == '/mobile':
            self.send_response(302)
            self.send_header('Location', f'http://{IP_ADDRESS}:{HTTP_PORT}/mobile.html')
            self.end_headers()
        else:
            return super().do_GET()
    
    def log_message(self, format, *args):
        pass

# Start HTTP server
def start_http_server():
    with socketserver.TCPServer(("", HTTP_PORT), StatusHandler) as httpd:
        logger.info(f"🌐 Status page: http://{IP_ADDRESS}:{HTTP_PORT}")
        httpd.serve_forever()

# Create PID file for process management
PID_FILE = LOG_DIR / 'receiver.pid'

def write_pid():
    with open(PID_FILE, 'w') as f:
        f.write(str(os.getpid()))

def remove_pid():
    try:
        PID_FILE.unlink()
    except:
        pass

# Main async function
async def main():
    write_pid()
    
    if DEBUG_MODE:
        print("=" * 50)
        print("🎤 Whispr Flow - DEBUG MODE")
        print("=" * 50)
        print(f"\n📡 WebSocket: ws://{IP_ADDRESS}:{WS_PORT}")
        print(f"🌐 Status page: http://{IP_ADDRESS}:{HTTP_PORT}")
        print(f"📝 Logs: {LOG_FILE}")
        print(f"\n📱 iPhone URL: http://{IP_ADDRESS}:{HTTP_PORT}/mobile")
        print("\n⏳ Waiting for iPhone connection...")
        print("   (Press Ctrl+C to stop)\n")
    else:
        logger.info("🎤 Whispr Flow Receiver started (silent mode)")
        logger.info(f"Status page: http://{IP_ADDRESS}:{HTTP_PORT}")
        logger.info(f"Logs: {LOG_FILE}")
    
    # Start HTTP server in background thread
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()
    
    # Start WebSocket server
    async with websockets.serve(websocket_handler, "", WS_PORT):
        await asyncio.Future()

# Handle graceful shutdown
def signal_handler(sig, frame):
    logger.info('👋 Shutting down...')
    remove_pid()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def check_dependencies():
    """Check and report missing dependencies"""
    missing = []
    
    try:
        subprocess.run(['xclip', '-version'], capture_output=True, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        missing.append('xclip')
    
    if missing:
        msg = f"Missing dependencies: {', '.join(missing)}\nRun: sudo apt install {' '.join(missing)}"
        logger.error(msg)
        if DEBUG_MODE:
            print(f"❌ {msg}")
        return False
    return True

if __name__ == "__main__":
    # Check if already running
    if PID_FILE.exists():
        try:
            with open(PID_FILE) as f:
                old_pid = int(f.read().strip())
            os.kill(old_pid, 0)  # Check if process exists
            msg = f"Receiver already running (PID: {old_pid})"
            logger.warning(msg)
            if DEBUG_MODE:
                print(f"⚠️  {msg}")
                print(f"   Stop it first, or run with: kill {old_pid}")
            sys.exit(1)
        except (ValueError, OSError, ProcessLookupError):
            # Stale PID file
            PID_FILE.unlink()
    
    if not check_dependencies():
        sys.exit(1)
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info('👋 Goodbye!')
        remove_pid()
    except Exception as e:
        logger.exception("Unexpected error")
        remove_pid()
        raise
