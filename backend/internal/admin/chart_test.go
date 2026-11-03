package admin

import (
	"strings"
	"testing"
	"time"

	"movex/internal/repo"
)

func TestAutoDetectServerType(t *testing.T) {
	tests := []struct {
		url      string
		expected string
	}{
		{"https://player.videasy.net/embed/movie/123", "VIDEASY"},
		{"https://vidsrc.me/embed/movie?id=456", "VIDSRC"},
		{"https://vidsrc.to/embed/tv/789", "VIDSRC"},
		{"https://streamwish.to/e/abc123xyz", "STREAMWISH"},
		{"https://cdn.example.com/stream/master.m3u8", "HLS_DIRECT"},
		{"https://cdn.example.com/video/movie.mp4", "HLS_DIRECT"},
		{"https://unknown-embed.com/play/123", "EMBED"},
	}

	for _, tt := range tests {
		got := AutoDetectServerType(tt.url)
		if got != tt.expected {
			t.Errorf("AutoDetectServerType(%q) = %q; want %q", tt.url, got, tt.expected)
		}
	}
}

func TestGenerateUserGrowthChartSVG(t *testing.T) {
	now := time.Now().UnixMilli()
	dayMs := int64(24 * 60 * 60 * 1000)

	users := []repo.User{
		{UID: "u1", CreatedAt: now - 1*dayMs, Status: "active"},
		{UID: "u2", CreatedAt: now - 1*dayMs, Status: "active"},
		{UID: "u3", CreatedAt: now - 3*dayMs, Status: "active"},
		{UID: "u4", CreatedAt: now - 5*dayMs, Status: "deleted"}, // Should be ignored
	}

	svg := GenerateUserGrowthChartSVG(users, 7)
	svgStr := string(svg)

	if !strings.Contains(svgStr, "<svg") || !strings.Contains(svgStr, "</svg>") {
		t.Fatalf("expected valid SVG element")
	}
	if !strings.Contains(svgStr, "linearGradient") {
		t.Errorf("expected gradient definition in SVG")
	}
	if !strings.Contains(svgStr, "stroke=\"#10b981\"") {
		t.Errorf("expected emerald stroke color in SVG")
	}
}
