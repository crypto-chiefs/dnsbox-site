package main

import (
	"bytes"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"
)

type siteHandler struct {
	root *os.Root
}

func newSiteHandler(directory string) (*siteHandler, error) {
	root, err := os.OpenRoot(directory)
	if err != nil {
		return nil, err
	}
	return &siteHandler{root: root}, nil
}

func (h *siteHandler) Close() error { return h.root.Close() }

func (h *siteHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; upgrade-insecure-requests;")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
	w.Header().Set("X-Frame-Options", "DENY")

	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	requestPath := r.URL.Path
	host := r.Host
	if hostname, _, err := net.SplitHostPort(host); err == nil {
		host = hostname
	}
	canonicalHost := strings.EqualFold(host, "dnsbox-site-server-j4bmt.ondigitalocean.app") || strings.EqualFold(host, "www.dnsbox.io")
	canonicalIndex := requestPath == "/index.html" || requestPath == "/en.html"
	if canonicalHost || canonicalIndex {
		target := url.URL{Path: requestPath, RawPath: r.URL.RawPath, RawQuery: r.URL.RawQuery, ForceQuery: r.URL.ForceQuery}
		if canonicalIndex {
			target.Path, target.RawPath = "/", ""
		}
		if canonicalHost {
			target.Scheme, target.Host = "https", "dnsbox.io"
		}
		http.Redirect(w, r, target.String(), http.StatusMovedPermanently)
		return
	}
	if !strings.HasPrefix(requestPath, "/") || path.Clean(requestPath) != requestPath || strings.ContainsAny(requestPath, "\\\x00:") {
		http.NotFound(w, r)
		return
	}

	name := strings.TrimPrefix(requestPath, "/")
	if name == "" {
		name = "index.html"
	}
	// Root also prevents symlinks from escaping the published directory.
	file, err := h.root.Open(name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}
	content, err := io.ReadAll(file)
	if err != nil {
		log.Printf("read site file %q: %v", name, err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("ETag", fmt.Sprintf("\"%x\"", sha256.Sum256(content)))
	if strings.EqualFold(path.Ext(name), ".html") {
		w.Header().Set("Cache-Control", "public, max-age=0, must-revalidate")
	} else {
		w.Header().Set("Cache-Control", "public, max-age=300")
	}
	// Release builds normalize mtimes. Revalidate actual bytes with the ETag,
	// rather than sending a misleading Last-Modified date such as 1980.
	http.ServeContent(w, r, name, time.Time{}, bytes.NewReader(content))
}

func main() {
	handler, err := newSiteHandler("./dist")
	if err != nil {
		log.Fatalf("open published site: %v", err)
	}
	defer handler.Close()
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("serve site: %v", err)
	}
}
