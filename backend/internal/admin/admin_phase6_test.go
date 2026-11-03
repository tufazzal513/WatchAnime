package admin

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"movex/internal/repo"
)

func TestCategoriesLifecycle(t *testing.T) {
	mux, _, adminMgr, _ := setupAdminTest(t)
	cookie := getAuthCookie(adminMgr)
	csrf := adminMgr.GenerateCSRFToken("admin-test-uid")

	// 1. Save Category
	form := url.Values{
		"csrf_token": {csrf},
		"name":       {"Anime"},
		"sort_order": {"1"},
	}
	reqSave := httptest.NewRequest(http.MethodPost, "/admin/categories/save", strings.NewReader(form.Encode()))
	reqSave.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reqSave.AddCookie(cookie)
	rrSave := httptest.NewRecorder()
	mux.ServeHTTP(rrSave, reqSave)

	if rrSave.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 redirect, got %d", rrSave.Code)
	}

	// 2. List Categories
	reqList := httptest.NewRequest(http.MethodGet, "/admin/categories", nil)
	reqList.AddCookie(cookie)
	rrList := httptest.NewRecorder()
	mux.ServeHTTP(rrList, reqList)

	if rrList.Code != http.StatusOK || !strings.Contains(rrList.Body.String(), "Anime") {
		t.Fatalf("expected 200 with 'Anime' in body")
	}
}

func TestBannersLifecycle(t *testing.T) {
	mux, _, adminMgr, _ := setupAdminTest(t)
	cookie := getAuthCookie(adminMgr)
	csrf := adminMgr.GenerateCSRFToken("admin-test-uid")

	// Save Banner
	form := url.Values{
		"csrf_token": {csrf},
		"title":      {"Grand Promo"},
		"image_url":  {"https://example.com/promo.jpg"},
		"link_url":   {"/movie/123"},
		"active":     {"1"},
	}
	reqSave := httptest.NewRequest(http.MethodPost, "/admin/banners/save", strings.NewReader(form.Encode()))
	reqSave.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reqSave.AddCookie(cookie)
	rrSave := httptest.NewRecorder()
	mux.ServeHTTP(rrSave, reqSave)

	if rrSave.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 redirect, got %d", rrSave.Code)
	}

	// List Banners
	reqList := httptest.NewRequest(http.MethodGet, "/admin/banners", nil)
	reqList.AddCookie(cookie)
	rrList := httptest.NewRecorder()
	mux.ServeHTTP(rrList, reqList)

	if rrList.Code != http.StatusOK || !strings.Contains(rrList.Body.String(), "Grand Promo") {
		t.Fatalf("expected 200 with 'Grand Promo'")
	}
}

func TestUsersManagement(t *testing.T) {
	mux, h, adminMgr, _ := setupAdminTest(t)
	cookie := getAuthCookie(adminMgr)
	csrf := adminMgr.GenerateCSRFToken("admin-test-uid")

	// Create user
	_ = h.userRepo.UpsertUser(&repo.User{
		UID:    "user-to-freeze",
		Email:  "freeze@example.com",
		Status: "active",
	})

	// 1. Freeze user
	form := url.Values{
		"csrf_token": {csrf},
		"status":     {"frozen"},
	}
	reqFreeze := httptest.NewRequest(http.MethodPost, "/admin/users/user-to-freeze/status", strings.NewReader(form.Encode()))
	reqFreeze.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reqFreeze.AddCookie(cookie)
	rrFreeze := httptest.NewRecorder()
	mux.ServeHTTP(rrFreeze, reqFreeze)

	if rrFreeze.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 for freeze, got %d", rrFreeze.Code)
	}

	u, _ := h.userRepo.GetUser("user-to-freeze")
	if u.Status != "frozen" {
		t.Errorf("expected user status to be frozen, got %s", u.Status)
	}

	// 2. List users
	reqList := httptest.NewRequest(http.MethodGet, "/admin/users?status=frozen", nil)
	reqList.AddCookie(cookie)
	rrList := httptest.NewRecorder()
	mux.ServeHTTP(rrList, reqList)

	if rrList.Code != http.StatusOK || !strings.Contains(rrList.Body.String(), "freeze@example.com") {
		t.Errorf("expected frozen user in list")
	}
}

func TestBrokenLinksManagement(t *testing.T) {
	mux, h, adminMgr, _ := setupAdminTest(t)
	cookie := getAuthCookie(adminMgr)
	csrf := adminMgr.GenerateCSRFToken("admin-test-uid")

	// Report a broken link
	bl := &repo.BrokenLink{
		MovieID:    "m-test",
		Title:      "Demon Slayer",
		EpInfo:     "Episode 5",
		ServerType: "VIDEASY",
		Status:     "open",
	}
	_ = h.userRepo.ReportBrokenLink(bl)

	// 1. Mark as fixed
	form := url.Values{
		"csrf_token": {csrf},
		"status":     {"fixed"},
	}
	reqFix := httptest.NewRequest(http.MethodPost, "/admin/broken-links/"+bl.ID+"/status", strings.NewReader(form.Encode()))
	reqFix.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reqFix.AddCookie(cookie)
	rrFix := httptest.NewRecorder()
	mux.ServeHTTP(rrFix, reqFix)

	if rrFix.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 for status update, got %d", rrFix.Code)
	}

	// 2. List broken links
	reqList := httptest.NewRequest(http.MethodGet, "/admin/broken-links?status=fixed", nil)
	reqList.AddCookie(cookie)
	rrList := httptest.NewRecorder()
	mux.ServeHTTP(rrList, reqList)

	if rrList.Code != http.StatusOK || !strings.Contains(rrList.Body.String(), "Demon Slayer") {
		t.Errorf("expected fixed report in list")
	}
}

func TestSettingsAndNotifications(t *testing.T) {
	mux, _, adminMgr, _ := setupAdminTest(t)
	cookie := getAuthCookie(adminMgr)
	csrf := adminMgr.GenerateCSRFToken("admin-test-uid")

	// 1. Save Settings
	form := url.Values{
		"csrf_token":       {csrf},
		"site_name":        {"MoveX Global"},
		"announcement":     {"Mega update live"},
		"maintenance_mode": {"0"},
	}
	reqSave := httptest.NewRequest(http.MethodPost, "/admin/settings/save", strings.NewReader(form.Encode()))
	reqSave.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reqSave.AddCookie(cookie)
	rrSave := httptest.NewRecorder()
	mux.ServeHTTP(rrSave, reqSave)

	if rrSave.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 for settings save, got %d", rrSave.Code)
	}

	// 2. Broadcast Notification
	noteForm := url.Values{
		"csrf_token": {csrf},
		"title":      {"System Maintenance Complete"},
		"message":    {"Everything is running fast."},
	}
	reqNote := httptest.NewRequest(http.MethodPost, "/admin/settings/notify", strings.NewReader(noteForm.Encode()))
	reqNote.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reqNote.AddCookie(cookie)
	rrNote := httptest.NewRecorder()
	mux.ServeHTTP(rrNote, reqNote)

	if rrNote.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 for notify, got %d", rrNote.Code)
	}

	// 3. View Settings Page
	reqView := httptest.NewRequest(http.MethodGet, "/admin/settings", nil)
	reqView.AddCookie(cookie)
	rrView := httptest.NewRecorder()
	mux.ServeHTTP(rrView, reqView)

	if rrView.Code != http.StatusOK || !strings.Contains(rrView.Body.String(), "MoveX Global") {
		t.Errorf("expected settings view to display 'MoveX Global'")
	}
}

func TestServerAndWorkersCluster(t *testing.T) {
	mux, h, adminMgr, _ := setupAdminTest(t)
	cookie := getAuthCookie(adminMgr)
	csrf := adminMgr.GenerateCSRFToken("admin-test-uid")

	// 1. Add Worker
	form := url.Values{
		"csrf_token": {csrf},
		"name":       {"Tokyo-Edge-1"},
		"url":        {"https://tokyo.movex.edge"},
	}
	reqAdd := httptest.NewRequest(http.MethodPost, "/admin/server/workers/add", strings.NewReader(form.Encode()))
	reqAdd.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	reqAdd.AddCookie(cookie)
	rrAdd := httptest.NewRecorder()
	mux.ServeHTTP(rrAdd, reqAdd)

	if rrAdd.Code != http.StatusSeeOther {
		t.Fatalf("expected 303 for add worker, got %d", rrAdd.Code)
	}

	// Verify Worker in DB
	workers, _ := h.userRepo.ListWorkers()
	if len(workers) != 1 || workers[0].Name != "Tokyo-Edge-1" {
		t.Fatalf("expected worker Tokyo-Edge-1 to be saved")
	}

	// 2. Server View
	reqView := httptest.NewRequest(http.MethodGet, "/admin/server", nil)
	reqView.AddCookie(cookie)
	rrView := httptest.NewRecorder()
	mux.ServeHTTP(rrView, reqView)

	if rrView.Code != http.StatusOK || !strings.Contains(rrView.Body.String(), "Tokyo-Edge-1") {
		t.Errorf("expected server view to list Tokyo-Edge-1")
	}
}
