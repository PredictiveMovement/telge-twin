# Local Elasticsearch & Kibana Setup

Docker setup for local development with Elasticsearch, Kibana, and the Telge Twin simulator. Versions match the production cluster.

## Quick Start

1. **Create environment file**:
```bash
cd packages/simulator
cp .env.example .env
# Edit .env and add your TELGE_API credentials
cd ../..
```

2. **Start everything**:
```bash
docker-compose --env-file packages/simulator/.env up
```

This will:
1. Start Elasticsearch and wait for it to be healthy
2. Run preboot to create indices
3. Start Kibana
4. Start the simulator backend

## Services

| Service | URL | Description |
|---------|-----|-------------|
| Simulator API | http://localhost:4000 | Backend API and WebSocket server |
| Elasticsearch | http://localhost:9200 | Data storage |
| Kibana | http://localhost:5601 | Elasticsearch UI |

## What Gets Created

Preboot automatically creates 4 Elasticsearch indices:
- `bookings` - Delivery bookings and assignments
- `route-datasets` - Uploaded route data
- `truck-plans` - Optimized vehicle plans
- `experiments` - Simulation experiments

Mappings are defined in: `packages/simulator/data/elasticsearch_mappings.json`

## Environment Variables

The same `.env` file in `packages/simulator/` is used for both:
- Running simulator directly in your IDE (`pnpm run simulator`)
- Running in Docker (`docker-compose up`)

Required variables (in `packages/simulator/.env`):
- `TELGE_API_BASE_URL` - Telge API endpoint
- `TELGE_API_USERNAME` - Telge API username  
- `TELGE_API_PASSWORD` - Telge API password

For Docker: Elasticsearch URL is automatically set to `http://elasticsearch:9200`
For local IDE: Set `ELASTICSEARCH_URL=http://localhost:9200` in `.env`

**Why `--env-file` flag?**
Docker Compose needs the `.env` file for build-time args (TELGE_API credentials are used during build). The `--env-file` flag tells Docker Compose where to find it. 

**Alternative (optional):** Create a symlink to avoid typing the flag:
```bash
ln -s packages/simulator/.env .env
# Now you can use: docker-compose up
```

## Commands

```bash
# Start all services
docker-compose --env-file packages/simulator/.env up

# Start in background
docker-compose --env-file packages/simulator/.env up -d

# Stop all services
docker-compose down

# Stop and remove data
docker-compose down -v

# View logs
docker-compose logs -f simulator
docker-compose logs -f elasticsearch

# Rebuild after code changes
docker-compose --env-file packages/simulator/.env up --build simulator
```

## Versions (from production cluster)

- **Elasticsearch:** 8.5.1
- **Kibana:** 8.5.1
- **Heap size:** 1-2GB
- **Security:** Disabled (for local development)

## Deployment Environments

| Environment | Namespace | Elasticsearch URL |
|-------------|-----------|-------------------|
| Production (K8s) | `elasticsearch` | `http://elasticsearch-master.elasticsearch.svc.cluster.local:9200` |
| Dev (K8s) | `elasticsearch-dev` | `http://elasticsearch-master.elasticsearch-dev.svc.cluster.local:9200` |
| Local (Docker) | - | `http://elasticsearch:9200` (internal) |

**Note:** In Kubernetes deployments, preboot runs automatically as an `initContainer` (see `k8s/overlays/dev/simulator.yaml`).

