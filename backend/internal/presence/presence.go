package presence

import (
	"sync"
	"time"
)

const (
	LiveWindow = 90 * time.Second
)

type Tracker struct {
	mu     sync.RWMutex
	online map[string]int64 // uid -> last_seen unix timestamp (ms)
}

func NewTracker() *Tracker {
	t := &Tracker{
		online: make(map[string]int64),
	}
	// Periodic cleanup of stale entries
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		for range ticker.C {
			t.mu.Lock()
			threshold := time.Now().Add(-LiveWindow).UnixMilli()
			for uid, lastSeen := range t.online {
				if lastSeen < threshold {
					delete(t.online, uid)
				}
			}
			t.mu.Unlock()
		}
	}()
	return t
}

// Heartbeat records a user's presence and returns the current total live online count.
func (t *Tracker) Heartbeat(uid string) int {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now().UnixMilli()
	t.online[uid] = now

	// Count live within window
	threshold := now - LiveWindow.Milliseconds()
	count := 0
	for _, ts := range t.online {
		if ts >= threshold {
			count++
		}
	}
	return count
}

// LiveCount returns the count of users active in the last 90 seconds.
func (t *Tracker) LiveCount() int {
	t.mu.RLock()
	defer t.mu.RUnlock()

	threshold := time.Now().Add(-LiveWindow).UnixMilli()
	count := 0
	for _, ts := range t.online {
		if ts >= threshold {
			count++
		}
	}
	return count
}

// IsOnline checks if a specific user is active.
func (t *Tracker) IsOnline(uid string) bool {
	t.mu.RLock()
	defer t.mu.RUnlock()

	lastSeen, ok := t.online[uid]
	if !ok {
		return false
	}
	return time.Now().UnixMilli()-lastSeen <= LiveWindow.Milliseconds()
}
