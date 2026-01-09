# Resource Usage & Capacity Estimation

This document estimates the resource requirements for running the Workstation code execution system.

---

## Per-Session Resource Usage

### Memory Usage (RAM)

| Framework | Idle Memory | Peak Memory | Notes |
|-----------|-------------|-------------|-------|
| Node.js / Express | 50-80 MB | 100-150 MB | nodemon adds ~20MB |
| Next.js | 150-300 MB | 400-600 MB | Includes webpack, React |
| React CRA | 200-350 MB | 500-800 MB | webpack-dev-server heavy |
| Vite | 80-150 MB | 200-300 MB | ESBuild is efficient |
| FastAPI (uvicorn) | 40-60 MB | 80-120 MB | Python is lightweight |
| Flask | 30-50 MB | 60-100 MB | Minimal footprint |
| Simple Web | 0 MB | 0 MB | No server process |

### CPU Usage

| Framework | Idle CPU | On File Change | npm install |
|-----------|----------|----------------|-------------|
| Node.js / Express | ~0% | 5-15% (restart) | 20-50% |
| Next.js | 1-3% | 10-30% (HMR compile) | 30-60% |
| React CRA | 2-5% | 15-40% (webpack rebuild) | 30-60% |
| Vite | ~0% | 5-10% (ESBuild) | 20-40% |
| FastAPI (uvicorn) | ~0% | 3-8% (reload) | 5-15% (pip) |
| Flask | ~0% | 3-8% (reload) | 5-15% (pip) |

### Disk Usage (Temp Directory)

| Framework | Base Files | After npm install | Total |
|-----------|------------|-------------------|-------|
| Node.js / Express | 10-50 KB | 20-50 MB | ~50 MB |
| Next.js | 50-200 KB | 150-300 MB | ~300 MB |
| React CRA | 50-150 KB | 200-400 MB | ~400 MB |
| Vite | 30-100 KB | 80-150 MB | ~150 MB |
| FastAPI | 5-20 KB | 10-30 MB (venv) | ~30 MB |
| Flask | 5-20 KB | 10-20 MB (venv) | ~20 MB |
| Simple Web | 5-50 KB | 0 | ~50 KB |

---

## Server Capacity Estimation

### Single Server (Typical VPS/Cloud VM)

**Specs: 4 vCPU, 8 GB RAM, 100 GB SSD**

| Metric | Conservative | Moderate | Aggressive |
|--------|--------------|----------|------------|
| Concurrent Node.js sessions | 30-40 | 50-60 | 80-100 |
| Concurrent Next.js sessions | 10-15 | 20-25 | 30-40 |
| Concurrent React CRA sessions | 8-12 | 15-20 | 25-35 |
| Concurrent Vite sessions | 25-35 | 40-50 | 60-80 |
| Concurrent FastAPI sessions | 50-70 | 80-100 | 120-150 |
| Concurrent Flask sessions | 60-80 | 100-120 | 150-180 |

**Mixed workload estimate (typical usage):**
- 40% Node.js/Express
- 20% Next.js/React
- 20% Vite
- 20% Python

**Result: ~30-50 concurrent sessions on a 4 vCPU / 8 GB RAM server**

---

### Server Sizing Recommendations

| Users | Concurrent Sessions | Recommended Server |
|-------|--------------------|--------------------|
| 10-50 | 5-15 | 2 vCPU, 4 GB RAM, 50 GB SSD |
| 50-200 | 15-50 | 4 vCPU, 8 GB RAM, 100 GB SSD |
| 200-500 | 50-150 | 8 vCPU, 16 GB RAM, 200 GB SSD |
| 500-1000 | 150-300 | 16 vCPU, 32 GB RAM, 500 GB SSD |
| 1000+ | 300+ | Multiple servers + Load balancer |

---

## Network Bandwidth

### Per Session

| Activity | Bandwidth |
|----------|-----------|
| SSE stream (terminal output) | 1-10 KB/s |
| File sync (live reload) | 1-50 KB per save |
| npm install download | 10-100 MB total |
| pip install download | 1-20 MB total |
| Browser preview iframe | Varies (typically 50-500 KB/s) |

### Server Total (50 concurrent sessions)

| Metric | Estimate |
|--------|----------|
| Steady-state bandwidth | 0.5-5 MB/s |
| Peak (many npm installs) | 20-50 MB/s |
| Monthly transfer | 500 GB - 2 TB |

---

## Port Usage

Each session requires one dynamic port (range: 1024-65535).

| Metric | Value |
|--------|-------|
| Ports per session | 1 |
| Available ports | ~64,000 |
| Max theoretical sessions | 64,000 |
| Recommended max sessions | 1,000-5,000 (with cleanup) |

**Note:** Ports are released when sessions are stopped/cleaned up.

---

## Temp Directory Cleanup

### Without Cleanup

| Sessions | Disk Usage (worst case) |
|----------|------------------------|
| 10 | 4 GB |
| 50 | 20 GB |
| 100 | 40 GB |
| 500 | 200 GB |

### With Automatic Cleanup (recommended)

Implement session timeout and cleanup:

```python
# Suggested cleanup settings
SESSION_TIMEOUT = 30 * 60  # 30 minutes idle
MAX_SESSION_AGE = 2 * 60 * 60  # 2 hours max
CLEANUP_INTERVAL = 5 * 60  # Check every 5 minutes
```

| Sessions | Disk Usage (with cleanup) |
|----------|--------------------------|
| 10 | 1-2 GB |
| 50 | 5-10 GB |
| 100 | 10-20 GB |
| 500 | 50-100 GB |

---

## Process Limits

### Per-Session Processes

| Framework | Main Process | Child Processes | Total |
|-----------|--------------|-----------------|-------|
| Node.js + nodemon | 2 | 0-1 | 2-3 |
| Next.js | 1 | 2-4 (workers) | 3-5 |
| React CRA | 1 | 2-4 (workers) | 3-5 |
| Vite | 1 | 1-2 | 2-3 |
| uvicorn --reload | 1 | 1-2 (workers) | 2-3 |
| Flask | 1 | 0-1 | 1-2 |

### System Limits

| OS | Default Process Limit | Recommended |
|----|----------------------|-------------|
| Linux | 1024-4096 | Increase to 10000+ |
| Windows | ~500 handles per process | Use Job Objects |

**Linux ulimit settings:**
```bash
# /etc/security/limits.conf
* soft nofile 65535
* hard nofile 65535
* soft nproc 32768
* hard nproc 32768
```

---

## Cost Estimation (Cloud)

### AWS EC2 / DigitalOcean / Vultr

| Size | Specs | Monthly Cost | Concurrent Sessions |
|------|-------|--------------|---------------------|
| Small | 2 vCPU, 4 GB | $20-40 | 10-30 |
| Medium | 4 vCPU, 8 GB | $40-80 | 30-60 |
| Large | 8 vCPU, 16 GB | $80-160 | 60-120 |
| XL | 16 vCPU, 32 GB | $160-320 | 120-250 |

### Additional Costs

| Item | Monthly Cost |
|------|--------------|
| Bandwidth (1 TB) | $0-10 (usually free) |
| SSD storage (100 GB) | $10-20 |
| Backups | $5-10 |
| Load balancer (if scaling) | $10-20 |

**Estimated total for 50 concurrent users: $50-100/month**

---

## Scaling Strategies

### Vertical Scaling (Single Server)
- Increase RAM first (biggest bottleneck)
- Add more CPU cores for compilation
- Use SSD for faster npm install

### Horizontal Scaling (Multiple Servers)
- Use load balancer (nginx, HAProxy)
- Sticky sessions (session affinity) required
- Shared storage for project files (optional)
- Redis for session state (optional)

### Container-Based (Docker/Kubernetes)
- Each session in isolated container
- Better security and resource limits
- More overhead per session (~50-100 MB)
- Easier horizontal scaling

---

## Monitoring Recommendations

### Key Metrics to Track

| Metric | Warning | Critical |
|--------|---------|----------|
| RAM Usage | > 70% | > 90% |
| CPU Usage | > 70% | > 90% |
| Disk Usage | > 70% | > 90% |
| Active Sessions | > 80% capacity | > 95% capacity |
| Port Exhaustion | < 1000 free | < 100 free |
| Process Count | > 500 | > 1000 |

### Recommended Tools
- **Metrics:** Prometheus + Grafana
- **Logs:** ELK Stack or Loki
- **Alerts:** PagerDuty, Slack webhooks
- **APM:** New Relic, Datadog (optional)

---

## Summary

### Minimum Requirements (Development/Testing)
- 2 vCPU, 4 GB RAM, 50 GB SSD
- Supports: 10-20 concurrent sessions
- Cost: ~$20-40/month

### Recommended (Small Production)
- 4 vCPU, 8 GB RAM, 100 GB SSD
- Supports: 30-60 concurrent sessions
- Cost: ~$50-100/month

### Enterprise (Large Scale)
- 16+ vCPU, 32+ GB RAM, 500+ GB SSD
- Or: Multiple servers with load balancer
- Supports: 150-500+ concurrent sessions
- Cost: ~$200-500+/month
