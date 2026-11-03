package auth

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"movex/internal/config"
)

const (
	AdminCookieName = "mx_admin"
	SessionDuration = 12 * time.Hour
)

type ContextKey string

const (
	AdminUIDKey   ContextKey = "admin_uid"
	UserClaimsKey ContextKey = "user_claims"
)

type AdminManager struct {
	cfg        *config.Config
	httpClient *http.Client
}

func NewAdminManager(cfg *config.Config) *AdminManager {
	return &AdminManager{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

type firebaseSignInResponse struct {
	LocalID      string `json:"localId"` // Firebase UID
	Email        string `json:"email"`
	IDToken      string `json:"idToken"`
	RefreshToken string `json:"refreshToken"`
	Error        *struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
	} `json:"error"`
}

// AuthenticateAdmin checks environment credentials first, then calls Firebase REST API.
func (m *AdminManager) AuthenticateAdmin(email, password string) (string, error) {
	adminUser := strings.ToLower(strings.TrimSpace(m.cfg.AdminUsername))
	if adminUser == "" {
		adminUser = "admin"
	}
	adminPass := m.cfg.AdminPassword
	if adminPass == "" {
		adminPass = "admin123"
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(email))

	// Check environment credentials
	if password == adminPass {
		if cleanEmail == adminUser ||
			cleanEmail == adminUser+"@movex.com" ||
			cleanEmail == adminUser+"@movex.app" ||
			cleanEmail == "admin@movex.app" ||
			cleanEmail == "admin@movex.com" ||
			cleanEmail == "admin" ||
			adminUser == "admin" {
			return "admin_root", nil
		}
	}

	if m.cfg.FirebaseAPIKey != "" {
		payload := map[string]any{
			"email":             email,
			"password":          password,
			"returnSecureToken": true,
		}
		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return "", err
		}

		url := fmt.Sprintf("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=%s", m.cfg.FirebaseAPIKey)
		req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(bodyBytes))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := m.httpClient.Do(req)
		if err != nil {
			return "", fmt.Errorf("failed to contact Firebase auth service: %w", err)
		}
		defer resp.Body.Close()

		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			return "", err
		}

		var res firebaseSignInResponse
		if err := json.Unmarshal(respBody, &res); err != nil {
			return "", fmt.Errorf("failed to parse auth response: %w", err)
		}

		if res.Error != nil && res.Error.Message != "" {
			return "", fmt.Errorf("auth_failed: %s", res.Error.Message)
		}

		if res.LocalID != "" && m.cfg.IsAdmin(res.LocalID) {
			return res.LocalID, nil
		}
	}

	return "", errors.New("invalid credentials")
}

// SetAdminSession issues a signed HttpOnly session cookie.
func (m *AdminManager) SetAdminSession(w http.ResponseWriter, uid string) {
	exp := time.Now().Add(SessionDuration).Unix()
	payload := fmt.Sprintf("%s:%d", uid, exp)
	sig := m.signHMAC(payload)
	val := fmt.Sprintf("%s:%s", payload, sig)

	http.SetCookie(w, &http.Cookie{
		Name:     AdminCookieName,
		Value:    val,
		Path:     "/admin",
		Expires:  time.Unix(exp, 0),
		MaxAge:   int(SessionDuration.Seconds()),
		HttpOnly: true,
		Secure:   m.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

// ClearAdminSession clears the admin session cookie.
func (m *AdminManager) ClearAdminSession(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     AdminCookieName,
		Value:    "",
		Path:     "/admin",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   m.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

// GetAdminSession verifies the session cookie, checks expiration, and checks current admin membership.
func (m *AdminManager) GetAdminSession(r *http.Request) (string, error) {
	cookie, err := r.Cookie(AdminCookieName)
	if err != nil || cookie.Value == "" {
		return "", errors.New("no_session_cookie")
	}

	parts := strings.Split(cookie.Value, ":")
	if len(parts) != 3 {
		return "", errors.New("invalid_session_format")
	}

	uid := parts[0]
	expStr := parts[1]
	sig := parts[2]

	payload := fmt.Sprintf("%s:%s", uid, expStr)
	expectedSig := m.signHMAC(payload)
	if subtle.ConstantTimeCompare([]byte(sig), []byte(expectedSig)) != 1 {
		return "", errors.New("invalid_session_signature")
	}

	exp, err := strconv.ParseInt(expStr, 10, 64)
	if err != nil || time.Now().Unix() > exp {
		return "", errors.New("session_expired")
	}

	// Always verify UID is still an admin in current config
	if !m.cfg.IsAdmin(uid) {
		return "", errors.New("admin_privileges_revoked")
	}

	return uid, nil
}

// GenerateCSRFToken generates a session-bound CSRF token valid for the admin.
func (m *AdminManager) GenerateCSRFToken(uid string) string {
	ts := time.Now().Unix()
	msg := fmt.Sprintf("%s:%d", uid, ts)
	mac := hmac.New(sha256.New, m.cfg.SessionSecret)
	mac.Write([]byte(msg))
	sig := hex.EncodeToString(mac.Sum(nil))
	raw := fmt.Sprintf("%s:%d:%s", uid, ts, sig)
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

// ValidateCSRFToken checks the validity and expiration of the CSRF token (12h TTL).
func (m *AdminManager) ValidateCSRFToken(uid, token string) bool {
	data, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return false
	}
	parts := strings.Split(string(data), ":")
	if len(parts) != 3 {
		return false
	}
	tokenUID := parts[0]
	tsStr := parts[1]
	sig := parts[2]

	if tokenUID != uid {
		return false
	}

	ts, err := strconv.ParseInt(tsStr, 10, 64)
	if err != nil {
		return false
	}
	// Token expires after 12 hours
	if time.Now().Unix()-ts > int64(SessionDuration.Seconds()) {
		return false
	}

	msg := fmt.Sprintf("%s:%s", tokenUID, tsStr)
	mac := hmac.New(sha256.New, m.cfg.SessionSecret)
	mac.Write([]byte(msg))
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	return subtle.ConstantTimeCompare([]byte(sig), []byte(expectedSig)) == 1
}

func (m *AdminManager) signHMAC(payload string) string {
	mac := hmac.New(sha256.New, m.cfg.SessionSecret)
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}
