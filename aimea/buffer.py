"""
Rolling buffer to store recent transcript text.
"""
import collections
import time


class RollingBuffer:
    """
    A time-based rolling buffer that holds transcript segments
    for a configurable time window (in seconds).
    """
    def __init__(self, window_seconds: float = 120.0):
        self.window_seconds = window_seconds
        self._buffer = collections.deque()

    def add(self, text: str) -> None:
        """Add a new transcript segment to the buffer."""
        timestamp = time.time()
        self._buffer.append((timestamp, text))
        self._trim()

    def _trim(self) -> None:
        """Remove segments older than the buffer window."""
        cutoff = time.time() - self.window_seconds
        while self._buffer and self._buffer[0][0] < cutoff:
            self._buffer.popleft()

    def get_contents(self) -> str:
        """Get concatenated transcript text within the buffer window."""
        self._trim()
        return " ".join(text for _, text in self._buffer)