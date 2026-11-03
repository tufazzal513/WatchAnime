package auth

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	GoogleJWKSURL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
)

// TokenClaims represents standard verified Firebase claims.
type TokenClaims struct {
	UID       string         `json:"sub"`
	Email     string         `json:"email"`
	Name      string         `json:"name"`
	Picture   string         `json:"picture"`
	Issuer    string         `json:"iss"`
	Audience  string         `json:"aud"`
	ExpiresAt int64          `json:"exp"`
	IssuedAt  int64          `json:"iat"`
	Raw       map[string]any `json:"-"`
}

type jwkKey struct {
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type jwksResponse struct {
	Keys []jwkKey `json:"keys"`
}

// TokenVerifier validates Firebase ID tokens using Google's public JWKS.
type TokenVerifier struct {
	projectID       string
	devInsecureAuth bool
	jwksURL         string
	httpClient      *http.Client

	mu        sync.RWMutex
	keys      map[string]*rsa.PublicKey
	keysExp   time.Time
	lastFetch time.Time

	cacheMu    sync.RWMutex
	cache      map[string]*cachedToken
	cacheClean time.Time
}

type cachedToken struct {
	claims  *TokenClaims
	expires time.Time
}

func NewTokenVerifier(projectID string, devInsecureAuth bool) *TokenVerifier {
	return &TokenVerifier{
		projectID:       projectID,
		devInsecureAuth: devInsecureAuth,
		jwksURL:         GoogleJWKSURL,
		httpClient:      &http.Client{Timeout: 10 * time.Second},
		keys:            make(map[string]*rsa.PublicKey),
		cache:           make(map[string]*cachedToken),
	}
}

// VerifyToken validates a Bearer token and extracts verified claims.
func (v *TokenVerifier) VerifyToken(tokenString string) (*TokenClaims, error) {
	tokenString = strings.TrimSpace(tokenString)
	if tokenString == "" {
		return nil, errors.New("empty_token")
	}

	// 1. Dev Insecure Auth mode (for test suite)
	if v.devInsecureAuth && strings.HasPrefix(tokenString, "dev:") {
		uid := strings.TrimPrefix(tokenString, "dev:")
		return &TokenClaims{
			UID:       uid,
			Email:     uid + "@dev.local",
			Name:      "Dev " + uid,
			ExpiresAt: time.Now().Add(24 * time.Hour).Unix(),
			IssuedAt:  time.Now().Unix(),
		}, nil
	}

	// 2. Check token cache
	v.cacheMu.RLock()
	if item, found := v.cache[tokenString]; found {
		if time.Now().Before(item.expires) {
			v.cacheMu.RUnlock()
			return item.claims, nil
		}
	}
	v.cacheMu.RUnlock()

	// 3. Parse JWT parts (Header.Payload.Signature)
	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return nil, errors.New("invalid_token_format")
	}

	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("invalid_header_encoding: %w", err)
	}

	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	if err := json.Unmarshal(headerJSON, &header); err != nil {
		return nil, fmt.Errorf("invalid_header_json: %w", err)
	}

	if header.Alg != "RS256" {
		return nil, fmt.Errorf("unsupported_algorithm: %s (must be RS256)", header.Alg)
	}
	if header.Kid == "" {
		return nil, errors.New("missing_kid")
	}

	payloadJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid_payload_encoding: %w", err)
	}

	var claims TokenClaims
	if err := json.Unmarshal(payloadJSON, &claims); err != nil {
		return nil, fmt.Errorf("invalid_payload_json: %w", err)
	}

	// 4. Verify public key signature
	pubKey, err := v.getPublicKey(header.Kid)
	if err != nil {
		return nil, fmt.Errorf("key_lookup_failed: %w", err)
	}

	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("invalid_signature_encoding: %w", err)
	}

	signedData := []byte(parts[0] + "." + parts[1])
	h := sha256.Sum256(signedData)
	if err := rsa.VerifyPKCS1v15(pubKey, crypto.SHA256, h[:], sig); err != nil {
		return nil, errors.New("signature_verification_failed")
	}

	// 5. Semantic validations
	now := time.Now().Unix()

	if claims.UID == "" || len(claims.UID) > 128 {
		return nil, errors.New("invalid_sub_claim")
	}
	if claims.ExpiresAt <= now {
		return nil, errors.New("token_expired")
	}
	if claims.IssuedAt > now+300 { // 5-minute future skew allowance
		return nil, errors.New("token_issued_in_future")
	}

	if v.projectID != "" {
		if claims.Audience != v.projectID {
			return nil, fmt.Errorf("audience_mismatch: got %s, want %s", claims.Audience, v.projectID)
		}
		expectedIss := "https://securetoken.google.com/" + v.projectID
		if claims.Issuer != expectedIss {
			return nil, fmt.Errorf("issuer_mismatch: got %s, want %s", claims.Issuer, expectedIss)
		}
	}

	// 6. Cache verified token
	cacheTTL := time.Until(time.Unix(claims.ExpiresAt, 0))
	if cacheTTL > 10*time.Minute {
		cacheTTL = 10 * time.Minute
	}
	if cacheTTL > 0 {
		v.cacheMu.Lock()
		v.cache[tokenString] = &cachedToken{
			claims:  &claims,
			expires: time.Now().Add(cacheTTL),
		}
		// Periodically clean cache
		if time.Since(v.cacheClean) > 15*time.Minute {
			nowTime := time.Now()
			for k, vItem := range v.cache {
				if nowTime.After(vItem.expires) {
					delete(v.cache, k)
				}
			}
			v.cacheClean = nowTime
		}
		v.cacheMu.Unlock()
	}

	return &claims, nil
}

func (v *TokenVerifier) getPublicKey(kid string) (*rsa.PublicKey, error) {
	v.mu.RLock()
	key, found := v.keys[kid]
	expired := time.Now().After(v.keysExp)
	v.mu.RUnlock()

	if found && !expired {
		return key, nil
	}

	// Refetch JWKS
	v.mu.Lock()
	defer v.mu.Unlock()

	// Double check inside write lock
	if key, found := v.keys[kid]; found && time.Now().Before(v.keysExp) {
		return key, nil
	}

	// Prevent excessive refetching (max once per minute if key unknown)
	if time.Since(v.lastFetch) < 1*time.Minute && len(v.keys) > 0 {
		if key, ok := v.keys[kid]; ok {
			return key, nil
		}
		return nil, fmt.Errorf("unknown_key_id: %s (rate_limited)", kid)
	}

	if err := v.fetchJWKS(); err != nil {
		return nil, err
	}

	key, found = v.keys[kid]
	if !found {
		return nil, fmt.Errorf("unknown_key_id_after_refresh: %s", kid)
	}
	return key, nil
}

func (v *TokenVerifier) fetchJWKS() error {
	resp, err := v.httpClient.Get(v.jwksURL)
	if err != nil {
		return fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("JWKS request returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read JWKS body: %w", err)
	}

	var jwks jwksResponse
	if err := json.Unmarshal(body, &jwks); err != nil {
		return fmt.Errorf("failed to unmarshal JWKS: %w", err)
	}

	newKeys := make(map[string]*rsa.PublicKey)
	for _, k := range jwks.Keys {
		if k.Kty != "RSA" || k.N == "" || k.E == "" {
			continue
		}
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			continue
		}

		n := big.NewInt(0).SetBytes(nBytes)
		var e int
		for _, b := range eBytes {
			e = (e << 8) | int(b)
		}

		newKeys[k.Kid] = &rsa.PublicKey{
			N: n,
			E: e,
		}
	}

	v.keys = newKeys
	v.lastFetch = time.Now()
	// Default to 1-hour expiration
	v.keysExp = time.Now().Add(1 * time.Hour)
	return nil
}
