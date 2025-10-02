# Astrolabe - Kubernetes Resource Topology Visualizer

Interactive Grafana app plugin for visualizing Kubernetes resource relationships and topology.

## Features

- **Interactive Graph Visualization** - Pan, zoom, and explore Kubernetes resources with react-flow
- **Multiple View Scopes** - Cluster, Namespace, or Release-based views
- **Resource Relationships** - Automatic edge detection for:
  - Owner references (Deployment→ReplicaSet→Pod)
  - Service→Endpoints→Pods
  - PVC↔PV connections
  - Pod→ConfigMap/Secret/ServiceAccount
  - And more...
- **Smart Filtering** - Filter by status, kind, search, or "problems only"
- **Status Visualization** - Color-coded resources (Ready/Error/Pending/Unknown)
- **Resource Details** - View replicas, restarts, age, and metadata
- **Live Updates** - Real-time updates via SSE/WebSocket (planned)

## Prerequisites

- Grafana 10.4.0 or later
- Node.js 22 or later
- Go 1.21 or later (for backend)
- kubernetes-state-server running (provides the graph API)

## Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the frontend:**
   ```bash
   npm run dev  # Watch mode
   # or
   npm run build  # Production build
   ```

3. **Build the backend:**
   ```bash
   mage -v build:linux
   ```

4. **Start Grafana with the plugin:**
   ```bash
   docker compose up
   ```

5. **Access Grafana:**
   - Open http://localhost:3000
   - Navigate to Apps → Astrolabe
   - The Graph page should load automatically

## Configuration

### Indexer URL

The app connects to `kubernetes-state-server` at `http://localhost:8080` by default. To change this:

1. Go to Configuration (cog icon in the sidebar)
2. Update the Indexer Base URL
3. Save settings

### API Endpoints

The app expects these endpoints from kubernetes-state-server:

- `GET /namespaces` - List all namespaces
- `GET /kinds` - List all resource kinds
- `GET /releases` - List Helm releases
- `GET /graph?scope=cluster` - Get cluster-wide graph
- `GET /graph?scope=namespace&namespaces=a,b` - Get namespace graph
- `GET /graph?scope=release&release=ns/name` - Get release graph
- `GET /stream?scope=...` - SSE stream for live updates (planned)

## Architecture

### Frontend

- **React + TypeScript** - Modern React with strict typing
- **react-flow** - Graph visualization with pan/zoom
- **elkjs** - Hierarchical graph layout
- **@grafana/ui** - Grafana UI components
- **Emotion CSS** - Styling

### Components

- `GraphPage` - Main page with filters and graph
- `GraphCanvas` - react-flow wrapper with layout
- `GraphNode` - Custom node renderer
- `FilterBar` - Status, kind, search filters
- `indexerClient` - API client for kubernetes-state-server
- `edgeResolver` - Builds relationship edges

### Utilities (from panel plugin)

- `statusColors` - Status color mapping
- `resourceIcons` - Icon mapping for K8s kinds
- `resourceTypes` - Resource capability checks
- `ageUtils` - Age parsing and color coding
- `resourceGrouping` - Filtering and grouping logic

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run e2e

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix
```

## Deployment

1. Build the plugin:
   ```bash
   npm run build
   mage -v build:linux
   ```

2. Sign the plugin (if needed):
   ```bash
   npm run sign
   ```

3. Copy the `dist/` directory to your Grafana plugins folder

4. Restart Grafana

## Troubleshooting

### Graph not loading

- Check that kubernetes-state-server is running at the configured URL
- Open browser console to see API errors
- Verify the `/graph` endpoint returns valid data

### Build errors

- Ensure Node.js 22+ is installed
- Delete `node_modules` and run `npm install` again
- Check that all dependencies are installed

### Backend errors

- Ensure Go 1.21+ is installed
- Run `mage -v build:linux` to rebuild the backend
- Check Grafana logs for backend errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

Apache-2.0
