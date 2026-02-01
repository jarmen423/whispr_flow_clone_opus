#!/usr/bin/env python3
"""
Whispr Chromebook - Standalone Voice Transcription
Records audio locally, sends to Groq API, copies to clipboard
No iPhone needed!
"""

import os
import sys
import json
import subprocess
import tempfile
import threading
import queue
import time
from pathlib import Path
from datetime import datetime

# Try to import tkinter for GUI
try:
    import tkinter as tk
    from tkinter import ttk, messagebox, scrolledtext
    TKINTER_AVAILABLE = True
except ImportError:
    TKINTER_AVAILABLE = False
    print("Warning: tkinter not available, falling back to terminal mode")

# Configuration
LOG_DIR = Path.home() / '.local' / 'share' / 'whispr-flow'
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / 'whispr-chromebook.log'

CONFIG_DIR = Path.home() / '.config' / 'whispr-flow'
CONFIG_DIR.mkdir(parents=True, exist_ok=True)
CONFIG_FILE = CONFIG_DIR / 'config.json'

# Global variables
recording_process = None
is_recording = False
audio_queue = queue.Queue()

# Logging
def log(message):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_line = f"{timestamp} - {message}"
    print(log_line)
    with open(LOG_FILE, 'a') as f:
        f.write(log_line + '\n')

# Config management
def load_config():
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE) as f:
                return json.load(f)
        except:
            pass
    return {'groq_api_key': ''}

def save_config(config):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f)

def copy_to_clipboard(text):
    """Copy text to clipboard"""
    try:
        process = subprocess.Popen(['xclip', '-selection', 'clipboard'], 
                                   stdin=subprocess.PIPE, close_fds=True)
        process.communicate(input=text.encode('utf-8'))
        if process.returncode == 0:
            return True
    except:
        pass
    
    try:
        process = subprocess.Popen(['wl-copy'], stdin=subprocess.PIPE, close_fds=True)
        process.communicate(input=text.encode('utf-8'))
        if process.returncode == 0:
            return True
    except:
        pass
    
    try:
        process = subprocess.Popen(['xsel', '--clipboard', '--input'], 
                                   stdin=subprocess.PIPE, close_fds=True)
        process.communicate(input=text.encode('utf-8'))
        return process.returncode == 0
    except:
        pass
    
    return False

def record_audio(output_path, duration=None):
    """Record audio using arecord"""
    global recording_process
    
    # Record at 16kHz, mono, 16-bit (good for speech recognition)
    cmd = ['arecord', '-f', 'S16_LE', '-r', '16000', '-c', '1', output_path]
    
    if duration:
        cmd.extend(['-d', str(duration)])
    
    try:
        recording_process = subprocess.Popen(cmd, stderr=subprocess.PIPE)
        recording_process.wait()
    except Exception as e:
        log(f"Recording error: {e}")
        raise

def transcribe_with_groq(audio_path, api_key):
    """Send audio to Groq API for transcription"""
    import urllib.request
    import urllib.parse
    
    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    
    # Create multipart form data
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    
    def encode_multipart_formdata(fields, files):
        lines = []
        for key, value in fields.items():
            lines.append(f'--{boundary}')
            lines.append(f'Content-Disposition: form-data; name="{key}"')
            lines.append('')
            lines.append(value)
        
        for key, filepath in files.items():
            filename = os.path.basename(filepath)
            lines.append(f'--{boundary}')
            lines.append(f'Content-Disposition: form-data; name="{key}"; filename="{filename}"')
            lines.append('Content-Type: audio/wav')
            lines.append('')
            with open(filepath, 'rb') as f:
                lines.append(f.read().decode('latin-1'))
        
        lines.append(f'--{boundary}--')
        lines.append('')
        
        body = '\r\n'.join(lines)
        content_type = f'multipart/form-data; boundary={boundary}'
        return body.encode('latin-1'), content_type
    
    fields = {'model': 'whisper-large-v3', 'response_format': 'json'}
    files = {'file': audio_path}
    
    body, content_type = encode_multipart_formdata(fields, files)
    
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': content_type,
        'Content-Length': len(body)
    }
    
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result.get('text', '')
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        log(f"API Error: {error_body}")
        raise Exception(f"API Error: {e.code}")
    except Exception as e:
        log(f"Transcription error: {e}")
        raise

class WhisprChromebookApp:
    def __init__(self, root):
        self.root = root
        self.root.title("🎤 Whispr Chromebook")
        self.root.geometry("500x400")
        self.root.resizable(False, False)
        
        self.config = load_config()
        self.recording = False
        self.temp_audio_file = None
        
        # Style
        self.root.configure(bg='#f5f5f5')
        
        # Title
        title = tk.Label(root, text="🎤 Whispr Chromebook", 
                        font=('Helvetica', 20, 'bold'), 
                        bg='#f5f5f5', fg='#333')
        title.pack(pady=20)
        
        subtitle = tk.Label(root, text="Record → Transcribe → Copy", 
                           font=('Helvetica', 12), 
                           bg='#f5f5f5', fg='#666')
        subtitle.pack()
        
        # API Key Frame
        api_frame = tk.Frame(root, bg='#f5f5f5')
        api_frame.pack(pady=15, padx=30, fill='x')
        
        tk.Label(api_frame, text="Groq API Key:", 
                bg='#f5f5f5', font=('Helvetica', 11)).pack(anchor='w')
        
        self.api_entry = tk.Entry(api_frame, show='•', font=('Helvetica', 11))
        self.api_entry.pack(fill='x', pady=5)
        self.api_entry.insert(0, self.config.get('groq_api_key', ''))
        
        # Show/Hide API key
        self.show_api = tk.BooleanVar(value=False)
        tk.Checkbutton(api_frame, text="Show key", variable=self.show_api,
                      command=self.toggle_api_visibility,
                      bg='#f5f5f5').pack(anchor='w')
        
        # Status
        self.status_label = tk.Label(root, text="Ready to record", 
                                    font=('Helvetica', 14), 
                                    bg='#f5f5f5', fg='#10b981')
        self.status_label.pack(pady=20)
        
        # Big Record Button
        self.record_btn = tk.Button(root, text="🔴 START RECORDING", 
                                   font=('Helvetica', 16, 'bold'),
                                   bg='#ef4444', fg='white',
                                   activebackground='#dc2626',
                                   relief='flat',
                                   cursor='hand2',
                                   command=self.toggle_recording)
        self.record_btn.pack(pady=10, ipadx=20, ipady=10)
        
        # Result Text
        result_frame = tk.Frame(root, bg='#f5f5f5')
        result_frame.pack(pady=10, padx=30, fill='both', expand=True)
        
        tk.Label(result_frame, text="Last transcription:", 
                bg='#f5f5f5', font=('Helvetica', 10)).pack(anchor='w')
        
        self.result_text = scrolledtext.ScrolledText(
            result_frame, height=5, wrap=tk.WORD,
            font=('Helvetica', 11)
        )
        self.result_text.pack(fill='both', expand=True, pady=5)
        
        # Footer
        footer = tk.Label(root, text="Press button to start/stop • Auto-copies to clipboard", 
                         font=('Helvetica', 9), 
                         bg='#f5f5f5', fg='#999')
        footer.pack(pady=10)
        
        # Check dependencies
        self.check_deps()
    
    def toggle_api_visibility(self):
        if self.show_api.get():
            self.api_entry.config(show='')
        else:
            self.api_entry.config(show='•')
    
    def check_deps(self):
        """Check if arecord is available"""
        try:
            subprocess.run(['arecord', '--version'], capture_output=True, check=True)
        except:
            messagebox.showwarning("Missing Dependency", 
                "arecord not found. Please install alsa-utils:\n\n"
                "sudo apt install alsa-utils")
    
    def toggle_recording(self):
        if not self.recording:
            self.start_recording()
        else:
            self.stop_recording()
    
    def start_recording(self):
        api_key = self.api_entry.get().strip()
        if not api_key:
            messagebox.showerror("Error", "Please enter your Groq API key")
            return
        
        # Save API key
        self.config['groq_api_key'] = api_key
        save_config(self.config)
        
        self.recording = True
        self.status_label.config(text="🔴 Recording... (click to stop)", fg='#ef4444')
        self.record_btn.config(text="⏹ STOP RECORDING", bg='#6b7280')
        
        # Create temp file for audio
        self.temp_audio_file = tempfile.mktemp(suffix='.wav')
        
        # Start recording in background thread
        self.record_thread = threading.Thread(target=self._record_worker)
        self.record_thread.start()
        
        log("Started recording")
    
    def _record_worker(self):
        """Background thread for recording"""
        try:
            record_audio(self.temp_audio_file)
        except Exception as e:
            log(f"Recording failed: {e}")
            self.root.after(0, lambda: self.recording_error(str(e)))
    
    def stop_recording(self):
        if not self.recording:
            return
        
        self.recording = False
        self.status_label.config(text="⏳ Processing...", fg='#f59e0b')
        self.record_btn.config(text="⏳ Processing...", bg='#f59e0b', state='disabled')
        
        # Stop arecord
        global recording_process
        if recording_process:
            try:
                recording_process.terminate()
                recording_process.wait(timeout=2)
            except:
                try:
                    recording_process.kill()
                except:
                    pass
        
        # Wait for recording thread to finish
        if hasattr(self, 'record_thread'):
            self.record_thread.join(timeout=3)
        
        # Process in background
        process_thread = threading.Thread(target=self._process_audio)
        process_thread.start()
        
        log("Stopped recording, processing...")
    
    def _process_audio(self):
        """Background thread for transcription"""
        try:
            api_key = self.config.get('groq_api_key', '')
            text = transcribe_with_groq(self.temp_audio_file, api_key)
            
            if text:
                # Copy to clipboard
                if copy_to_clipboard(text):
                    log(f"Transcribed: {text[:50]}...")
                    self.root.after(0, lambda: self.transcription_done(text, True))
                else:
                    self.root.after(0, lambda: self.transcription_done(text, False))
            else:
                self.root.after(0, lambda: self.transcription_done("(no speech detected)", False))
                
        except Exception as e:
            log(f"Transcription failed: {e}")
            self.root.after(0, lambda: self.transcription_error(str(e)))
        finally:
            # Clean up temp file
            if self.temp_audio_file and os.path.exists(self.temp_audio_file):
                try:
                    os.remove(self.temp_audio_file)
                except:
                    pass
    
    def transcription_done(self, text, copied):
        self.result_text.delete('1.0', tk.END)
        self.result_text.insert('1.0', text)
        
        if copied:
            self.status_label.config(text="✅ Copied to clipboard!", fg='#10b981')
        else:
            self.status_label.config(text="⚠️ Transcribed but clipboard failed", fg='#f59e0b')
        
        self.record_btn.config(text="🔴 START RECORDING", bg='#ef4444', state='normal')
        self.recording = False
    
    def transcription_error(self, error):
        self.status_label.config(text=f"❌ Error: {error[:50]}", fg='#ef4444')
        self.record_btn.config(text="🔴 START RECORDING", bg='#ef4444', state='normal')
        self.recording = False
        messagebox.showerror("Transcription Failed", error)
    
    def recording_error(self, error):
        self.status_label.config(text="❌ Recording failed", fg='#ef4444')
        self.record_btn.config(text="🔴 START RECORDING", bg='#ef4444', state='normal')
        self.recording = False

def main():
    if not TKINTER_AVAILABLE:
        print("ERROR: This app requires a graphical environment.")
        print("Make sure you're running in Linux with GUI support.")
        sys.exit(1)
    
    root = tk.Tk()
    app = WhisprChromebookApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()
