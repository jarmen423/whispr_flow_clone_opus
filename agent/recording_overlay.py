#!/usr/bin/env python3
"""
Recording Overlay for LocalFlow Desktop Agent

Provides visual feedback when recording is active with a floating overlay
window showing an animated waveform with shimmer effect.

Dependencies:
    pip install tkinter (usually included with Python)

Usage:
    overlay = RecordingOverlay()
    overlay.show()  # Show overlay when recording starts
    overlay.hide()  # Hide overlay when recording stops
"""

import tkinter as tk
import threading
import math
import time
from typing import Optional


class RecordingOverlay:
    """
    A floating overlay window that displays visual feedback during recording.
    
    Features:
    - Animated waveform bars
    - CSS-like shimmer effect
    - Semi-transparent background
    - Always on top
    - Click-through (non-blocking)
    """

    def __init__(self, bar_count: int = 5):
        """
        Initialize the recording overlay.
        
        Args:
            bar_count: Number of bars in the waveform visualization
        """
        self.bar_count = bar_count
        self.root: Optional[tk.Tk] = None
        self.canvas: Optional[tk.Canvas] = None
        self.is_visible = False
        self.animation_running = False
        self.animation_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        
        # Colors
        self.bg_color = "#1a1a2e"
        self.bar_colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#feca57"]
        self.shimmer_color = "#ffffff"
        
        # Overlay dimensions
        self.width = 120
        self.height = 50
        self.bar_width = 12
        self.bar_gap = 8
        self.corner_radius = 12
        
        # Animation state
        self.phase = 0.0
        self.shimmer_phase = 0.0

    def _create_window(self):
        """Create the overlay window on the main thread."""
        self.root = tk.Tk()
        self.root.title("Recording")
        
        # Make it a tool window (no taskbar entry)
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        self.root.attributes("-alpha", 0.95)
        
        # Try to make it click-through on Windows
        try:
            self.root.attributes("-transparentcolor", self.bg_color)
        except:
            pass
        
        # Position in bottom-right corner
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        x = screen_width - self.width - 20
        y = screen_height - self.height - 60
        self.root.geometry(f"{self.width}x{self.height}+{x}+{y}")
        
        # Create canvas for drawing
        self.canvas = tk.Canvas(
            self.root,
            width=self.width,
            height=self.height,
            bg=self.bg_color,
            highlightthickness=0
        )
        self.canvas.pack()
        
        # Draw rounded background
        self._draw_rounded_rect(
            2, 2, self.width - 2, self.height - 2,
            self.corner_radius, fill="#2d2d44", outline="#4a4a6a"
        )

    def _draw_rounded_rect(self, x1, y1, x2, y2, radius, **kwargs):
        """Draw a rounded rectangle on the canvas."""
        points = [
            x1 + radius, y1,
            x2 - radius, y1,
            x2, y1,
            x2, y1 + radius,
            x2, y2 - radius,
            x2, y2,
            x2 - radius, y2,
            x1 + radius, y2,
            x1, y2,
            x1, y2 - radius,
            x1, y1 + radius,
            x1, y1,
        ]
        return self.canvas.create_polygon(points, smooth=True, **kwargs)

    def _animate(self):
        """Animation loop for the waveform using Tkinter's thread-safe after().
        
        This method schedules itself to run repeatedly using root.after(),
        which ensures all canvas operations occur on the Tkinter main thread.
        This avoids the 'main thread is not in main loop' RuntimeError that
        occurs when manipulating Tkinter widgets from background threads.
        """
        if not self.animation_running or not self.root or not self.is_visible:
            return
        
        try:
            self._draw_frame()
            # Schedule next frame using after() - this is thread-safe
            self.root.after(30, self._animate)  # ~30 FPS
        except tk.TclError:
            # Window was destroyed, stop animating
            pass

    def _draw_frame(self):
        """Draw a single animation frame."""
        if not self.canvas:
            return
        
        try:
            self.canvas.delete("bars")
            self.canvas.delete("shimmer")
        except tk.TclError:
            return  # Canvas was destroyed
        
        self.phase += 0.15
        self.shimmer_phase += 0.08
        
        total_width = (self.bar_width * self.bar_count) + (self.bar_gap * (self.bar_count - 1))
        start_x = (self.width - total_width) / 2
        
        for i in range(self.bar_count):
            # Calculate bar height with wave animation
            wave = math.sin(self.phase + i * 0.8)
            height = 12 + wave * 10
            
            x = start_x + i * (self.bar_width + self.bar_gap)
            y1 = (self.height - height) / 2
            y2 = y1 + height
            
            # Draw bar with gradient-like effect
            color = self.bar_colors[i % len(self.bar_colors)]
            self.canvas.create_rectangle(
                x, y1, x + self.bar_width, y2,
                fill=color, outline="", tags="bars"
            )
            
            # Add shimmer effect
            shimmer_offset = (math.sin(self.shimmer_phase + i * 0.3) + 1) / 2
            shimmer_width = 3
            shimmer_x = x + shimmer_offset * (self.bar_width - shimmer_width)
            
            # Create shimmer highlight
            if shimmer_offset > 0.3 and shimmer_offset < 0.7:
                self.canvas.create_rectangle(
                    shimmer_x, y1 + 2, shimmer_x + shimmer_width, y2 - 2,
                    fill="#ffffff", outline="", stipple="gray50", tags="shimmer"
                )
        
        # Add "REC" indicator with pulsing effect
        pulse = (math.sin(self.phase * 0.5) + 1) / 2
        red_shade = int(200 + pulse * 55)
        rec_color = f"#{red_shade:02x}4040"
        
        self.canvas.delete("rec")
        self.canvas.create_oval(
            8, self.height/2 - 4, 16, self.height/2 + 4,
            fill=rec_color, outline="", tags="rec"
        )
        
        self.root.update_idletasks()

    def show(self):
        """Show the overlay and start animation.
        
        Creates the Tkinter window in a separate thread (since Tkinter must
        have its mainloop running) but schedules all animations via root.after()
        to ensure thread-safe canvas operations.
        """
        with self._lock:
            if self.is_visible:
                return
            self.is_visible = True
        
        def _show_window():
            self._create_window()
            self.animation_running = True
            # Start animation using after() - no separate thread needed
            self.root.after(30, self._animate)
            self.root.mainloop()
        
        # Run in a separate thread to not block
        threading.Thread(target=_show_window, daemon=True).start()

    def hide(self):
        """Hide the overlay and stop animation.
        
        Schedules window destruction on the Tkinter thread to avoid
        cross-thread Tkinter operations that cause RuntimeError.
        """
        with self._lock:
            if not self.is_visible:
                return
            self.is_visible = False
            self.animation_running = False
        
        if self.root:
            try:
                # Schedule destruction on the Tkinter thread
                def _destroy():
                    try:
                        self.root.quit()
                        self.root.destroy()
                    except:
                        pass
                    self.root = None
                    self.canvas = None
                
                self.root.after(0, _destroy)
            except:
                # Root may already be destroyed
                self.root = None
                self.canvas = None


# For testing standalone
if __name__ == "__main__":
    print("Testing recording overlay...")
    overlay = RecordingOverlay()
    overlay.show()
    time.sleep(5)
    overlay.hide()
    print("Done!")
