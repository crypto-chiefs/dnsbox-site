package main

import (
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func siteFixture(t *testing.T) (*siteHandler, string) {
	t.Helper()
	directory := t.TempDir()
	if err := os.Mkdir(filepath.Join(directory, "assets"), 0700); err != nil {
		t.Fatal(err)
	}
	for name, content := range map[string]string{
		"index.html":    "<!doctype html><title>DNSBox</title>",
		"ru.html":       "<!doctype html><title>DNSBox RU</title>",
		"assets/app.js": "console.log('DNSBox');\n",
	} {
		file := filepath.Join(directory, filepath.FromSlash(name))
		if err := os.WriteFile(file, []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
		old := time.Date(1980, 1, 1, 0, 0, 0, 0, time.UTC)
		if err := os.Chtimes(file, old, old); err != nil {
			t.Fatal(err)
		}
	}
	handler, err := newSiteHandler(directory)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { handler.Close() })
	return handler, directory
}

func siteRequest(handler http.Handler, method, target string, headers map[string]string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, target, nil)
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func checkSecurityHeaders(t *testing.T, response *httptest.ResponseRecorder) {
	t.Helper()
	for key, value := range map[string]string{
		"Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
		"X-Content-Type-Options":    "nosniff",
		"Referrer-Policy":           "strict-origin-when-cross-origin",
		"X-Frame-Options":           "DENY",
	} {
		if got := response.Header().Get(key); got != value {
			t.Errorf("%s=%q, want %q", key, got, value)
		}
	}
	if !strings.Contains(response.Header().Get("Content-Security-Policy"), "frame-ancestors 'none'; upgrade-insecure-requests;") {
		t.Error("missing existing content security policy")
	}
}

func TestCanonicalRedirects(t *testing.T) {
	handler, _ := siteFixture(t)
	for _, item := range []struct{ target, location string }{
		{"https://dnsbox.io/index.html?x=1&x=2%2F3", "/?x=1&x=2%2F3"},
		{"https://dnsbox.io/en.html?lang=en", "/?lang=en"},
		{"http://localhost:8080/index.html?health=1", "/?health=1"},
		{"http://dnsbox-site-server-j4bmt.ondigitalocean.app/ru.html?q=a%20b", "https://dnsbox.io/ru.html?q=a%20b"},
		{"https://www.dnsbox.io/index.html?q=1", "https://dnsbox.io/?q=1"},
		{"https://WWW.DNSBOX.IO:443/en.html", "https://dnsbox.io/"},
		{"https://www.dnsbox.io/a%20b.html?x=%2F", "https://dnsbox.io/a%20b.html?x=%2F"},
		{"https://www.dnsbox.io/assets/?x=1", "https://dnsbox.io/assets/?x=1"},
		{"https://www.dnsbox.io/unknown.html", "https://dnsbox.io/unknown.html"},
	} {
		t.Run(item.target, func(t *testing.T) {
			response := siteRequest(handler, http.MethodGet, item.target, nil)
			if response.Code != http.StatusMovedPermanently || response.Header().Get("Location") != item.location {
				t.Fatalf("status=%d location=%q", response.Code, response.Header().Get("Location"))
			}
			checkSecurityHeaders(t, response)
		})
	}
	for _, host := range []string{"dnsbox.io", "localhost:8080", "health.internal", "www.dnsbox.io.example", "dnsbox-site-server-j4bmt.ondigitalocean.app.example"} {
		response := siteRequest(handler, http.MethodGet, "http://"+host+"/", nil)
		if response.Code != http.StatusOK || response.Header().Get("Location") != "" {
			t.Errorf("unexpected redirect for %s: %d %q", host, response.Code, response.Header().Get("Location"))
		}
	}
}

func TestOnlyPublishedRegularFiles(t *testing.T) {
	handler, directory := siteFixture(t)
	for _, path := range []string{"/missing.html", "/assets", "/assets/", "/../index.html", "/%2e%2e/index.html", "/assets/../index.html", "/assets%5capp.js", "/assets/app.js:stream", "//assets/app.js", "/%00"} {
		response := siteRequest(handler, http.MethodGet, "http://localhost"+path, nil)
		if response.Code != http.StatusNotFound {
			t.Errorf("%s: status=%d, want404", path, response.Code)
		}
		checkSecurityHeaders(t, response)
	}
	outside := filepath.Join(t.TempDir(), "secret.txt")
	if err := os.WriteFile(outside, []byte("outside secret"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(directory, "escape.txt")); err != nil {
		t.Logf("symlink creation unavailable on this platform: %v", err)
	} else {
		response := siteRequest(handler, http.MethodGet, "http://localhost/escape.txt", nil)
		if response.Code != http.StatusNotFound || strings.Contains(response.Body.String(), "outside secret") {
			t.Fatalf("outside symlink exposed: %d %q", response.Code, response.Body.String())
		}
	}
}

func TestContentETagAndRevalidation(t *testing.T) {
	handler, directory := siteFixture(t)
	first := siteRequest(handler, http.MethodGet, "http://localhost/", nil)
	if first.Code != http.StatusOK || first.Header().Get("Cache-Control") != "public, max-age=0, must-revalidate" {
		t.Fatalf("unexpected HTML response: %d %v", first.Code, first.Header())
	}
	if first.Header().Get("Last-Modified") != "" {
		t.Fatal("normalized build mtime leaked as Last-Modified")
	}
	etag := fmt.Sprintf("\"%x\"", sha256.Sum256(first.Body.Bytes()))
	if first.Header().Get("ETag") != etag {
		t.Fatal("ETag is not a strong hash of the actual response")
	}
	for _, validator := range []string{etag, "W/" + etag, "\"other\", " + etag, "*"} {
		response := siteRequest(handler, http.MethodGet, "http://localhost/", map[string]string{"If-None-Match": validator})
		if response.Code != http.StatusNotModified || response.Body.Len() != 0 || response.Header().Get("ETag") != etag {
			t.Errorf("validator %s: status=%d body=%q etag=%q", validator, response.Code, response.Body.String(), response.Header().Get("ETag"))
		}
		checkSecurityHeaders(t, response)
	}
	// A date alone must not hide a newer deployment that has the same build mtime.
	response := siteRequest(handler, http.MethodGet, "http://localhost/", map[string]string{"If-Modified-Since": "Wed, 01 Jan 2098 00:00:00 GMT"})
	if response.Code != http.StatusOK {
		t.Fatalf("date-only validator unexpectedly returned%d", response.Code)
	}
	if err := os.WriteFile(filepath.Join(directory, "index.html"), []byte("updated deployment"), 0600); err != nil {
		t.Fatal(err)
	}
	old := time.Date(1980, 1, 1, 0, 0, 0, 0, time.UTC)
	if err := os.Chtimes(filepath.Join(directory, "index.html"), old, old); err != nil {
		t.Fatal(err)
	}
	response = siteRequest(handler, http.MethodGet, "http://localhost/", map[string]string{"If-None-Match": etag})
	if response.Code != http.StatusOK || response.Body.String() != "updated deployment" || response.Header().Get("ETag") == etag {
		t.Fatalf("old validator hid new content: %d %q", response.Code, response.Body.String())
	}
}

func TestAssetsAndHead(t *testing.T) {
	handler, _ := siteFixture(t)
	get := siteRequest(handler, http.MethodGet, "http://localhost/assets/app.js", nil)
	if get.Code != http.StatusOK || get.Header().Get("Cache-Control") != "public, max-age=300" {
		t.Fatalf("unexpected asset response: %d %v", get.Code, get.Header())
	}
	head := siteRequest(handler, http.MethodHead, "http://localhost/assets/app.js", nil)
	if head.Code != http.StatusOK || head.Body.Len() != 0 {
		t.Fatalf("HEAD status=%d body=%q", head.Code, head.Body.String())
	}
	for _, header := range []string{"Content-Length", "Content-Type", "ETag", "Cache-Control"} {
		if head.Header().Get(header) != get.Header().Get(header) {
			t.Errorf("HEAD %s differs from GET", header)
		}
	}
	response := siteRequest(handler, http.MethodHead, "http://localhost/assets/app.js", map[string]string{"If-None-Match": get.Header().Get("ETag")})
	if response.Code != http.StatusNotModified || response.Body.Len() != 0 {
		t.Fatalf("conditional HEAD status=%d", response.Code)
	}
	response = siteRequest(handler, http.MethodPost, "http://localhost/", nil)
	if response.Code != http.StatusMethodNotAllowed || response.Header().Get("Allow") != "GET, HEAD" {
		t.Fatalf("POST status=%d Allow=%q", response.Code, response.Header().Get("Allow"))
	}
}

func TestHeadErrorOverHTTP(t *testing.T) {
	handler, _ := siteFixture(t)
	server := httptest.NewServer(handler)
	defer server.Close()
	response, err := http.Head(server.URL + "/unknown")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil || response.StatusCode != http.StatusNotFound || len(body) != 0 {
		t.Fatalf("HEAD404 status=%d body=%q error=%v", response.StatusCode, body, err)
	}
}
