package plugin

import (
	"fmt"
	"io"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// proxyToIndexer forwards requests to the kubernetes-state-server
func (a *App) proxyToIndexer(w http.ResponseWriter, req *http.Request, path string) {
	// Get indexer URL from plugin settings
	indexerURL := a.getIndexerURL(req)

	// Build target URL
	targetURL := fmt.Sprintf("%s%s", indexerURL, path)
	if req.URL.RawQuery != "" {
		targetURL = fmt.Sprintf("%s?%s", targetURL, req.URL.RawQuery)
	}

	log.DefaultLogger.Debug("Proxying request", "target", targetURL)

	// Create new request
	proxyReq, err := http.NewRequest(req.Method, targetURL, req.Body)
	if err != nil {
		log.DefaultLogger.Error("Failed to create proxy request", "error", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Copy headers
	for key, values := range req.Header {
		for _, value := range values {
			proxyReq.Header.Add(key, value)
		}
	}

	// Make request
	client := &http.Client{}
	resp, err := client.Do(proxyReq)
	if err != nil {
		log.DefaultLogger.Error("Failed to proxy request", "error", err)
		http.Error(w, fmt.Sprintf("Failed to connect to kubernetes-state-server: %v", err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Copy status code
	w.WriteHeader(resp.StatusCode)

	// Copy response body
	if _, err := io.Copy(w, resp.Body); err != nil {
		log.DefaultLogger.Error("Failed to copy response body", "error", err)
	}
}

// getIndexerURL gets the indexer URL from plugin settings
func (a *App) getIndexerURL(req *http.Request) string {
	// Try to get from plugin context/settings
	// For now, use default or environment variable
	indexerURL := "http://astrolabe:8080"

	// TODO: Get from plugin settings when available
	// This would come from the AppConfig jsonData

	return indexerURL
}

// Handler functions for each endpoint
func (a *App) handleNamespaces(w http.ResponseWriter, req *http.Request) {
	a.proxyToIndexer(w, req, "/api/v1/namespaces")
}

func (a *App) handleReleases(w http.ResponseWriter, req *http.Request) {
	a.proxyToIndexer(w, req, "/api/v1/releases")
}

func (a *App) handleGraph(w http.ResponseWriter, req *http.Request) {
	a.proxyToIndexer(w, req, "/api/v1/graph")
}

func (a *App) handleResources(w http.ResponseWriter, req *http.Request) {
	a.proxyToIndexer(w, req, "/api/v1/resources")
}

// handlePing is an example HTTP GET resource that returns a {"message": "ok"} JSON response.
func (a *App) handlePing(w http.ResponseWriter, req *http.Request) {
	w.Header().Add("Content-Type", "application/json")
	if _, err := w.Write([]byte(`{"message": "ok"}`)); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// registerRoutes takes a *http.ServeMux and registers some HTTP handlers.
func (a *App) registerRoutes(mux *http.ServeMux) {
	// Kubernetes state server proxy endpoints
	mux.HandleFunc("/namespaces", a.handleNamespaces)
	mux.HandleFunc("/releases", a.handleReleases)
	mux.HandleFunc("/graph", a.handleGraph)
	mux.HandleFunc("/resources", a.handleResources)

	// Health check
	mux.HandleFunc("/ping", a.handlePing)
}
