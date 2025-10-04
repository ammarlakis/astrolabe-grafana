# Astrolabe Grafana App

Interactive Kubernetes resource topology and relationship visualizer for Grafana.

## Overview

Astrolabe is a Grafana app plugin that visualizes Kubernetes resources and their relationships as an interactive graph. It connects to the [Astrolabe Server](https://github.com/ammarlakis/astrolabe-server) to provide real-time topology views of your cluster.

## Features

- **Interactive Graph Visualization**: Explore Kubernetes resources with an interactive force-directed graph using React Flow
- **Multiple View Scopes**: Switch between cluster-wide, namespace, or Helm release views
- **Smart Resource Grouping**: Automatically groups related resources (Pods under Deployments, etc.)
- **Expandable Attachments**: Click to expand/collapse related resources like ReplicaSets, Pods, ConfigMaps
- **Status Indicators**: Visual health status for all resources (Ready, Pending, Error)
- **Advanced Filtering**: Filter by resource kind, status, or search by name
- **Helm-Aware**: First-class support for Helm releases and charts
- **Cluster-Scoped Resources**: Handles both namespaced and cluster-scoped resources (PVs, StorageClasses)

## Requirements

- Grafana 10.4.0 or later
- [Astrolabe Server](https://github.com/ammarlakis/astrolabe-server) deployed and accessible by grafana
- Node.js 22+ (for development)

## Installation

### From Grafana Catalog (Coming Soon)

1. Navigate to **Configuration** → **Plugins** in Grafana
2. Search for "Astrolabe"
3. Click **Install**

### Manual Installation

1. Download the latest release from the [releases page](https://github.com/ammarlakis/astrolabe-app/releases)
2. Extract to your Grafana plugins directory
3. Restart Grafana
4. Enable the plugin in **Configuration** → **Plugins**

## Configuration

1. Navigate to **Apps** → **Astrolabe** → **Configuration**
2. Enter your Astrolabe Server URL (e.g., `http://astrolabe.astrolabe-system.svc.cluster.local:8080`)
3. Save the configuration

The app proxies all requests through Grafana's backend, so no direct network access from the browser is required.

## Usage

### Graph View

1. Navigate to **Apps** → **Astrolabe** → **Graph**
2. Select your view scope:
   - **Cluster**: View all resources across the cluster
   - **Namespace**: Filter to a specific namespace
   - **Release**: View resources for a specific Helm release
3. Use filters to narrow down resources by kind, status, or name
4. Click on nodes to expand/collapse related resources
5. Drag nodes to rearrange the layout

### Resource Types

Supported Kubernetes resources:
- **Workloads**: Deployments, StatefulSets, DaemonSets, ReplicaSets, Jobs, CronJobs, Pods
- **Networking**: Services, Ingresses, EndpointSlices
- **Configuration**: ConfigMaps, Secrets, ServiceAccounts
- **Storage**: PersistentVolumeClaims, PersistentVolumes, StorageClasses
- **Autoscaling**: HorizontalPodAutoscalers

## Development

### Setup

```bash
# Install dependencies
npm install

# Build backend
mage -v

# Run in development mode
npm run dev

# Start Grafana with the plugin
npm run server
```

### Testing

```bash
# Run unit tests
npm run test

# Run E2E tests
npm run e2e
```

### Building

```bash
# Production build
npm run build

# Sign plugin (requires GRAFANA_API_KEY)
npm run sign
```

## Architecture

```
┌─────────────┐
│   Grafana   │
│  (Browser)  │
└──────┬──────┘
       │
       │ HTTP API
       │
┌──────▼──────────┐
│ Astrolabe App   │
│   (Plugin)      │
└──────┬──────────┘
       │
       │ Backend Proxy
       │
┌──────▼──────────┐
│ Astrolabe Server│
│  (In-Cluster)   │
└──────┬──────────┘
       │
       │ Watch API
       │
┌──────▼──────────┐
│   Kubernetes    │
│     Cluster     │
└─────────────────┘
```

## License

Licensed under the [GNU Affero General Public License v3.0 (AGPLv3)](LICENSE).

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request
