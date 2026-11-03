package auth

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"movex/internal/config"
)

func TestDevInsecureAuth(t *testing.T) {
	v := NewTokenVerifier("test-project", true)
	claims, err := v.VerifyToken("dev:my-admin-uid")
	if err != nil {
		t.Fatalf("expected dev token verification to succeed, got %v", err)
	}
	if claims.UID != "my-admin-uid" {
		t.Errorf("expected UID 'my-admin-uid', got %s", claims.UID)
	}
}

func TestVerifyTokenWithMockJWKS(t *testing.T) {
	// Generate RSA key pair
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	kid := "test-key-1"
	nStr := base64.RawURLEncoding.EncodeToString(privKey.N.Bytes())
	eBytes := []byte{1, 0, 1} // 65537
	eStr := base64.RawURLEncoding.EncodeToString(eBytes)

	// Mock JWKS server
	jwksServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := jwksResponse{
			Keys: []jwkKey{
				{Kty: "RSA", Alg: "RS256", Use: "sig", Kid: kid, N: nStr, E: eStr},
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer jwksServer.Close()

	verifier := NewTokenVerifier("my-project", false)
	verifier.jwksURL = jwksServer.URL

	// Construct valid JWT
	headerJSON := fmt.Sprintf(`{"alg":"RS256","kid":"%s"}`, kid)
	hB64 := base64.RawURLEncoding.EncodeToString([]byte(headerJSON))

	now := time.Now().Unix()
	claimsJSON := fmt.Sprintf(`{
		"sub": "user-456",
		"email": "user@example.com",
		"aud": "my-project",
		"iss": "https://securetoken.google.com/my-project",
		"iat": %d,
		"exp": %d
	}`, now, now+3600)
	pB64 := base64.RawURLEncoding.EncodeToString([]byte(claimsJSON))

	signedData := []byte(hB64 + "." + pB64)
	h := sha256.Sum256(signedData)
	sig, err := rsa.SignPKCS1v15(rand.Reader, privKey, crypto.SHA256, h[:])
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	sigB64 := base64.RawURLEncoding.EncodeToString(sig)

	tokenStr := fmt.Sprintf("%s.%s.%s", hB64, pB64, sigB64)

	// 1. Verify valid token
	claims, err := verifier.VerifyToken(tokenStr)
	if err != nil {
		t.Fatalf("expected valid token to verify, got %v", err)
	}
	if claims.UID != "user-456" {
		t.Errorf("expected UID 'user-456', got %s", claims.UID)
	}

	// 2. Cached token verification
	cachedClaims, err := verifier.VerifyToken(tokenStr)
	if err != nil || cachedClaims.UID != "user-456" {
		t.Fatalf("expected cached token to verify cleanly")
	}

	// 3. Tampered signature should fail
	tamperedToken := tokenStr + "bad"
	_, err = verifier.VerifyToken(tamperedToken)
	if err == nil {
		t.Errorf("expected tampered token to fail verification")
	}
}

func TestAdminSessionAndCSRF(t *testing.T) {
	cfg := &config.Config{
		Role:          "main",
		AdminUIDs:     []string{"admin-uid-1"},
		SessionSecret: []byte("very-secure-32-byte-secret-for-hmac!"),
		CookieSecure:  false,
	}
	mgr := NewAdminManager(cfg)

	// 1. Set Session Cookie
	rec := httptest.NewRecorder()
	mgr.SetAdminSession(rec, "admin-uid-1")

	cookies := rec.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatalf("expected session cookie to be set")
	}
	adminCookie := cookies[0]
	if adminCookie.Name != AdminCookieName || adminCookie.Value == "" {
		t.Fatalf("invalid cookie: %+v", adminCookie)
	}

	// 2. Verify Session
	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.AddCookie(adminCookie)

	uid, err := mgr.GetAdminSession(req)
	if err != nil {
		t.Fatalf("expected session to verify, got %v", err)
	}
	if uid != "admin-uid-1" {
		t.Errorf("expected uid 'admin-uid-1', got %s", uid)
	}

	// 3. Revoke admin UID from config -> must immediately deny session
	cfg.AdminUIDs = []string{"other-admin"}
	_, err = mgr.GetAdminSession(req)
	if err == nil {
		t.Errorf("expected session to be rejected after UID revoked")
	}
	cfg.AdminUIDs = []string{"admin-uid-1"}

	// 4. CSRF Token
	csrf := mgr.GenerateCSRFToken("admin-uid-1")
	if !mgr.ValidateCSRFToken("admin-uid-1", csrf) {
		t.Errorf("expected valid CSRF token to pass")
	}
	if mgr.ValidateCSRFToken("wrong-uid", csrf) {
		t.Errorf("expected CSRF token with wrong UID to fail")
	}
	if mgr.ValidateCSRFToken("admin-uid-1", csrf+"tampered") {
		t.Errorf("expected tampered CSRF token to fail")
	}
}
