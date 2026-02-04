#!/usr/bin/env python3
"""Recording Overlay for LocalFlow Desktop Agent - Visual feedback component.

This module provides the RecordingOverlay class, a floating visual feedback
window that displays during audio recording sessions. It serves as the
user-facing indicator that dictation is actively being captured, improving
the user experience by providing immediate visual confirmation of recording
state without interfering with the user's workflow.

Purpose & Reasoning:
    The overlay was created to solve the "silent recording" problem where
    users cannot tell if their dictation is being captured, leading to
    uncertainty about when to speak and when to release the hotkey. By
    providing a subtle, non-intrusive animated waveform visualization in
    the corner of the screen, users have clear visual feedback that
    recording is active. The overlay uses Tkinter for cross-platform
    compatibility without additional dependencies, and implements
    thread-safe rendering to work alongside the audio capture thread.

Dependencies:
    External Services:
        - None (pure Python implementation)
    
    Python Standard Library:
        - tkinter (tkinter): GUI framework for the overlay window
        - threading: Background thread management for Tkinter mainloop
        - math: Sine wave calculations for animation effects
        - time: Animation timing and standalone testing
        - typing: Type hints for Optional parameters

Role in Codebase:
    This utility is instantiated by the LocalFlowAgent class in
    localflow-agent.py and is called when recording starts (show())
    and stops (hide()). It runs in a separate daemon thread to avoid
    blocking the main agent event loop while maintaining Tkinter's
    requirement for mainloop execution on its own thread.

Usage:
    The overlay is typically used through the LocalFlowAgent:
    
    from recording_overlay import RecordingOverlay
    
    overlay = RecordingOverlay()
    overlay.show()  # Display overlay when recording starts
    # ... recording in progress ...
    overlay.hide()  # Hide overlay when recording stops

    For standalone testing:
    $ python recording_overlay.py

Example:
    >>> overlay = RecordingOverlay(bar_count=5)
    >>> overlay.show()  # Overlay appears in bottom-right corner
    >>> time.sleep(3)   # Animated waveform displays
    >>> overlay.hide()  # Overlay disappears
"""

import tkinter as tk
import threading
import math
import time
from typing import Optional


class RecordingOverlay:
    """A floating visual overlay window for recording feedback.

    This class creates and manages a floating, semi-transparent overlay
    window that displays an animated waveform visualization to indicate
    active audio recording. The overlay is designed to be non-intrusive
    with features like always-on-top positioning, click-through capability
    (where supported), and smooth animations using Tkinter's after() method
    for thread-safe rendering.

    The overlay implements a producer-consumer pattern where show()/hide()
    can be called from any thread, but all Tkinter operations are scheduled
    via after() to execute on the Tkinter main thread, preventing the
    "main thread is not in main loop" RuntimeError common in multi-threaded
    Tkinter applications.

    Key Technologies/APIs:
        - tkinter.Tk: Root window creation with overrideredirect (no
          window decorations), attributes for transparency and always-on-top
        - tkinter.Canvas: Custom drawing surface for waveform bars,
          rounded rectangles, and shimmer effects
        - threading.Thread: Background execution of Tkinter mainloop
          to prevent blocking the agent's main thread
        - tkinter.Widget.after: Thread-safe method scheduling for
          animation loop and safe window destruction
        - math.sin: Sine wave calculations for organic animation curves

    Attributes:
        bar_count: Number of animated waveform bars to display.
        root: The tkinter.Tk root window when visible, None when hidden.
        canvas: The tkinter.Canvas drawing surface when visible.
        is_visible: Boolean tracking overlay visibility state.
        animation_running: Boolean controlling animation loop execution.
        animation_thread: Thread running the Tkinter mainloop.
        _lock: threading.Lock for thread-safe state access.
        bg_color: Background color of the overlay window.
        bar_colors: List of colors for waveform bars (rainbow effect).
        shimmer_color: Color for the animated shimmer highlight.
        width: Window width in pixels.
        height: Window height in pixels.
        bar_width: Width of each waveform bar.
        bar_gap: Gap between waveform bars.
        corner_radius: Radius for rounded rectangle corners.
        phase: Animation phase counter for wave movement.
        shimmer_phase: Animation phase counter for shimmer effect.

    Example:
        >>> overlay = RecordingOverlay(bar_count=5)
        >>> overlay.show()
        >>> # Overlay is now visible with animated waveform
        >>> overlay.hide()
        >>> # Overlay is now hidden
    """

    def __init__(self, bar_count: int = 5) -> None:
        """Initialize the RecordingOverlay with default configuration.

        Sets up all visual parameters (colors, dimensions, animation state)
        but does not create the actual window. The window is created lazily
        when show() is called. This design allows the overlay to be
        instantiated at application startup without immediately displaying.

        Key Technologies/APIs:
            - threading.Lock initialization for thread-safe state management
            - Dataclass-style initialization of visual parameters

        Args:
            bar_count: Number of animated bars in the waveform visualization.
                More bars create a denser visualization. Defaults to 5.

        Returns:
            None
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

    def _create_window(self) -> None:
        """Create and configure the Tkinter overlay window.

        Initializes the tkinter.Tk root window with specific attributes
        for an overlay-style presentation: no window decorations (title bar,
        border), always on top, semi-transparent, and positioned in the
        bottom-right corner of the screen. Creates the Canvas widget for
        drawing the waveform visualization.

        Key Technologies/APIs:
            - tkinter.Tk: Root window creation
            - Tk.overrideredirect: Remove window manager decorations
            - Tk.attributes: Set -topmost, -alpha transparency
            - Tk.attributes -transparentcolor: Click-through on Windows
            - Tk.winfo_screenwidth/height: Screen dimension detection
            - Tk.geometry: Window positioning (bottom-right corner)
            - tkinter.Canvas: Drawing surface for waveform bars
            - Canvas.create_polygon: Rounded rectangle background

        Returns:
            None

        Note:
            This method must be called from the Tkinter thread (the thread
            that will run mainloop), not from arbitrary threads.
        """
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
            highlightthickness=0,
        )
        self.canvas.pack()

        # Draw rounded background
        self._draw_rounded_rect(
            2, 2, self.width - 2, self.height - 2, self.corner_radius, fill="#2d2d44", outline="#4a4a6a"
        )

    def _draw_rounded_rect(self, x1: int, y1: int, x2: int, y2: int, radius: int, **kwargs) -> int:
        """Draw a rounded rectangle on the canvas.

        Creates a polygon with smooth=True to approximate a rectangle
        with rounded corners. This is used for the overlay background
        to give it a modern, polished appearance.

        Key Technologies/APIs:
            - tkinter.Canvas.create_polygon: Multi-point shape creation
            - smooth=True: Bézier curve smoothing for rounded appearance
            - **kwargs: Forwarding of Canvas options (fill, outline, etc.)

        Args:
            x1: Left coordinate of the rectangle bounding box.
            y1: Top coordinate of the rectangle bounding box.
            x2: Right coordinate of the rectangle bounding box.
            y2: Bottom coordinate of the rectangle bounding box.
            radius: Corner radius in pixels. Larger values = more rounded.
            **kwargs: Additional Canvas.create_polygon options like
                fill (background color), outline (border color), etc.

        Returns:
            int: The canvas item ID for the created polygon, which can
                be used for later reference or deletion.
        """
        points = [
            x1 + radius,
            y1,
            x2 - radius,
            y1,
            x2,
            y1,
            x2,
            y1 + radius,
            x2,
            y2 - radius,
            x2,
            y2,
            x2 - radius,
            y2,
            x1 + radius,
            y2,
            x1,
            y2,
            x1,
            y2 - radius,
            x1,
            y1 + radius,
            x1,
            y1,
        ]
        return self.canvas.create_polygon(points, smooth=True, **kwargs)

    def _animate(self) -> None:
        """Animation loop entry point using thread-safe Tkinter after().

        This method is the entry point for the animation loop. It checks
        if animation should continue, draws a single frame via _draw_frame(),
        and schedules the next frame using root.after(). Using after()
        instead of a separate thread ensures all canvas operations occur
        on the Tkinter main thread, preventing the RuntimeError that
        occurs when manipulating Tkinter widgets from background threads.

        Key Technologies/APIs:
            - tkinter.Misc.after: Thread-safe delayed method invocation
            - _draw_frame: Single frame rendering method
            - tk.TclError: Exception handling for destroyed windows

        Returns:
            None: This method schedules itself to run repeatedly until
                animation_running is False or the window is destroyed.

        Note:
            This method must only be called from the Tkinter thread as
            it directly accesses Tkinter widgets.
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

    def _draw_frame(self) -> None:
        """Render a single animation frame of the waveform visualization.

        Draws one complete frame of the animated waveform including:
        - Animated waveform bars with sine wave height modulation
        - Shimmer highlights that travel across the bars
        - A pulsing "REC" indicator dot

        Clears previous frame elements (bars, shimmer, rec) before drawing
        to create smooth animation. Uses phase counters to create organic
        wave motion and shimmer effects.

        Key Technologies/APIs:
            - tkinter.Canvas.delete: Remove previous frame elements by tag
            - tkinter.Canvas.create_rectangle: Bar and shimmer drawing
            - tkinter.Canvas.create_oval: REC indicator dot
            - math.sin: Sine wave for organic animation curves
            - Root.update_idletasks: Force immediate canvas redraw

        Returns:
            None

        Note:
            This method must only be called from the Tkinter thread.
            It handles Tk.TclError gracefully if the canvas is destroyed.
        """
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
            self.canvas.create_rectangle(x, y1, x + self.bar_width, y2, fill=color, outline="", tags="bars")

            # Add shimmer effect
            shimmer_offset = (math.sin(self.shimmer_phase + i * 0.3) + 1) / 2
            shimmer_width = 3
            shimmer_x = x + shimmer_offset * (self.bar_width - shimmer_width)

            # Create shimmer highlight
            if shimmer_offset > 0.3 and shimmer_offset < 0.7:
                self.canvas.create_rectangle(
                    shimmer_x,
                    y1 + 2,
                    shimmer_x + shimmer_width,
                    y2 - 2,
                    fill="#ffffff",
                    outline="",
                    stipple="gray50",
                    tags="shimmer",
                )

        # Add "REC" indicator with pulsing effect
        pulse = (math.sin(self.phase * 0.5) + 1) / 2
        red_shade = int(200 + pulse * 55)
        rec_color = f"#{red_shade:02x}4040"

        self.canvas.delete("rec")
        self.canvas.create_oval(
            8, self.height / 2 - 4, 16, self.height / 2 + 4, fill=rec_color, outline="", tags="rec"
        )

        self.root.update_idletasks()

    def show(self) -> None:
        """Display the overlay window and start the animation loop.

        Creates the Tkinter window in a separate daemon thread and starts
        the animation loop. The use of a separate thread allows the overlay
        to run without blocking the main agent thread. Thread-safe state
        management ensures multiple show() calls are handled gracefully.

        Key Technologies/APIs:
            - threading.Lock: Thread-safe visibility state checking
            - threading.Thread: Background Tkinter mainloop execution
            - Tkinter.Tk.mainloop: Event loop for the overlay window
            - _create_window: Window initialization on Tkinter thread
            - _animate: Animation loop started via after()
            - daemon=True: Thread cleanup when main program exits

        Returns:
            None

        Note:
            This method is thread-safe and can be called from any thread.
            If the overlay is already visible, the call has no effect.
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

    def hide(self) -> None:
        """Hide the overlay window and stop the animation loop.

        Marks the overlay as hidden and schedules window destruction
        on the Tkinter thread via after(0, _destroy). This approach
        ensures thread-safe cleanup from any calling thread without
        causing cross-thread Tkinter access violations.

        Key Technologies/APIs:
            - threading.Lock: Thread-safe visibility state updates
            - Tkinter.Misc.after(0, callback): Immediate scheduling
              of destruction on the Tkinter main thread
            - Tk.quit/Tk.destroy: Graceful window teardown
            - Exception handling for already-destroyed windows

        Returns:
            None

        Note:
            This method is thread-safe and can be called from any thread.
            If the overlay is already hidden, the call has no effect.
            The actual window destruction is scheduled on the Tkinter
            thread to prevent RuntimeError from cross-thread access.
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
    """Standalone test entry point for the RecordingOverlay.

    When this module is run directly (not imported), creates a test
    instance of RecordingOverlay, displays it for 5 seconds, then
    hides it. This allows quick visual verification of overlay
    functionality without running the full LocalFlow agent.

    Key Technologies/APIs:
        - time.sleep: Test duration delay
        - RecordingOverlay.show/hide: Basic lifecycle test

    Example:
        $ python recording_overlay.py
        Testing recording overlay...
        Done!
    """
    print("Testing recording overlay...")
    overlay = RecordingOverlay()
    overlay.show()
    time.sleep(5)
    overlay.hide()
    print("Done!")
