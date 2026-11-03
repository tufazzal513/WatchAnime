package presence

import (
	"testing"
	"time"
)

func TestPresenceTracker(t *testing.T) {
	tracker := NewTracker()

	if count := tracker.LiveCount(); count != 0 {
		t.Fatalf("expected 0 initially, got %d", count)
	}

	// 1. User 1 heartbeat
	c1 := tracker.Heartbeat("user-1")
	if c1 != 1 {
		t.Errorf("expected 1 online, got %d", c1)
	}
	if !tracker.IsOnline("user-1") {
		t.Errorf("expected user-1 to be online")
	}
	if tracker.IsOnline("user-2") {
		t.Errorf("user-2 should not be online")
	}

	// 2. User 2 heartbeat
	c2 := tracker.Heartbeat("user-2")
	if c2 != 2 {
		t.Errorf("expected 2 online, got %d", c2)
	}

	// 3. Stale user expiration
	tracker.mu.Lock()
	tracker.online["user-stale"] = time.Now().Add(-100 * time.Second).UnixMilli()
	tracker.mu.Unlock()

	if tracker.IsOnline("user-stale") {
		t.Errorf("expected user-stale to be expired")
	}
	if tracker.LiveCount() != 2 {
		t.Errorf("expected 2 active users, got %d", tracker.LiveCount())
	}
}
