package admin

import (
	"fmt"
	"html/template"
	"strings"
	"time"

	"movex/internal/repo"
)

type DayPoint struct {
	Date  string
	Count int
}

// GenerateUserGrowthChartSVG builds an inline SVG line chart showing user growth.
// filterDays: 7, 30, or 0 (all time)
func GenerateUserGrowthChartSVG(users []repo.User, filterDays int) template.HTML {
	now := time.Now()
	dayCounts := make(map[string]int)

	numDays := filterDays
	if numDays <= 0 {
		numDays = 30
	}

	// Prepare day slots (YYYY-MM-DD)
	daysList := make([]string, numDays)
	for i := numDays - 1; i >= 0; i-- {
		d := now.AddDate(0, 0, -i)
		dateKey := d.Format("2006-01-02")
		daysList[numDays-1-i] = dateKey
		dayCounts[dateKey] = 0
	}

	// Tally user registrations
	for _, u := range users {
		if u.Status == "deleted" || u.CreatedAt == 0 {
			continue
		}
		t := time.UnixMilli(u.CreatedAt)
		dateKey := t.Format("2006-01-02")
		if _, ok := dayCounts[dateKey]; ok {
			dayCounts[dateKey]++
		}
	}

	points := make([]DayPoint, len(daysList))
	maxCount := 1
	totalInPeriod := 0
	for i, d := range daysList {
		cnt := dayCounts[d]
		points[i] = DayPoint{Date: d, Count: cnt}
		if cnt > maxCount {
			maxCount = cnt
		}
		totalInPeriod += cnt
	}

	// SVG Dimensions
	const (
		width   = 800.0
		height  = 240.0
		padL    = 50.0
		padR    = 30.0
		padT    = 30.0
		padB    = 40.0
	)

	chartW := width - padL - padR
	chartH := height - padT - padB

	// Generate coordinates
	type coord struct {
		x, y float64
		p    DayPoint
	}
	coords := make([]coord, len(points))
	stepX := chartW / float64(len(points)-1)
	if len(points) == 1 {
		stepX = 0
	}

	for i, p := range points {
		x := padL + float64(i)*stepX
		ratio := float64(p.Count) / float64(maxCount)
		y := (padT + chartH) - (ratio * chartH)
		coords[i] = coord{x: x, y: y, p: p}
	}

	// Build SVG path
	var pathPoints strings.Builder
	for i, c := range coords {
		if i == 0 {
			pathPoints.WriteString(fmt.Sprintf("M %.1f %.1f", c.x, c.y))
		} else {
			pathPoints.WriteString(fmt.Sprintf(" L %.1f %.1f", c.x, c.y))
		}
	}
	linePath := pathPoints.String()

	// Closed area path for gradient
	areaPath := fmt.Sprintf("%s L %.1f %.1f L %.1f %.1f Z", linePath, coords[len(coords)-1].x, padT+chartH, coords[0].x, padT+chartH)

	// Build grid lines and labels
	var gridLines strings.Builder
	numGrid := 4
	for i := 0; i <= numGrid; i++ {
		y := padT + (float64(i) * chartH / float64(numGrid))
		val := int(float64(maxCount) * float64(numGrid-i) / float64(numGrid))
		gridLines.WriteString(fmt.Sprintf(`
			<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#374151" stroke-dasharray="4,4" stroke-width="1"/>
			<text x="%.1f" y="%.1f" fill="#9ca3af" font-size="11" text-anchor="end">%d</text>`,
			padL, y, padL+chartW, y, padL-10, y+4, val,
		))
	}

	// X-axis date labels (show ~6 labels across the bottom)
	var xLabels strings.Builder
	labelInterval := len(points) / 6
	if labelInterval < 1 {
		labelInterval = 1
	}
	for i := 0; i < len(coords); i += labelInterval {
		c := coords[i]
		tPart := c.p.Date[5:] // MM-DD
		xLabels.WriteString(fmt.Sprintf(`
			<text x="%.1f" y="%.1f" fill="#9ca3af" font-size="11" text-anchor="middle">%s</text>`,
			c.x, height-15, tPart,
		))
	}

	// Data points & circles with title hover tooltips
	var dataCircles strings.Builder
	for _, c := range coords {
		dataCircles.WriteString(fmt.Sprintf(`
			<circle cx="%.1f" cy="%.1f" r="4" fill="#10b981" stroke="#1f2937" stroke-width="2" class="cursor-pointer transition-all hover:r-6">
				<title>%s: %d new users</title>
			</circle>`,
			c.x, c.y, c.p.Date, c.p.Count,
		))
	}

	svg := fmt.Sprintf(`
	<div class="relative w-full overflow-hidden">
		<svg viewBox="0 0 800 240" class="w-full h-auto overflow-visible select-none" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%%" stop-color="#10b981" stop-opacity="0.35"/>
					<stop offset="100%%" stop-color="#10b981" stop-opacity="0.0"/>
				</linearGradient>
			</defs>
			%s
			<path d="%s" fill="url(#chartGradient)"/>
			<path d="%s" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
			%s
			%s
		</svg>
	</div>`,
		gridLines.String(),
		areaPath,
		linePath,
		dataCircles.String(),
		xLabels.String(),
	)

	return template.HTML(svg)
}

// AutoDetectServerType applies the auto-detection rules specified in §৭.
func AutoDetectServerType(url string) string {
	lower := strings.ToLower(strings.TrimSpace(url))
	if strings.Contains(lower, "videasy.net") {
		return "VIDEASY"
	}
	if strings.Contains(lower, "vidsrc.me") || strings.Contains(lower, "vidsrc.to") || strings.Contains(lower, "vidsrc.xyz") {
		return "VIDSRC"
	}
	if strings.Contains(lower, "streamwish") || strings.Contains(lower, "wishfast") {
		return "STREAMWISH"
	}
	if strings.HasSuffix(lower, ".m3u8") || strings.HasSuffix(lower, ".mp4") {
		return "HLS_DIRECT"
	}
	return "EMBED"
}
