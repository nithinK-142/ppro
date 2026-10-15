# Observability

Prometheus collects API metrics. Grafana displays metrics and traces. Tempo stores request traces.

## What is collected

HTTP counts, status codes, latency, 5xx responses, in-flight requests, process memory/CPU, event-loop lag, PostgreSQL timings/errors, and HTTP/PostgreSQL traces. Route labels use route templates; request bodies, query strings, authorization headers, SQL text, parameters, user IDs, and emails are not recorded.

Prometheus retains 15 days or 5 GB of metrics. Tempo retains trace blocks for 48 hours. The alert rules detect API scrape failures, sustained 5xx rates, and high p95 latency. Rules do not send notifications until an Alertmanager or Grafana contact point is configured.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `METRICS_TOKEN` and `GRAFANA_ADMIN_PASSWORD`. Use the same metrics token in `server/.env` and `observability/.env`.
3. Set `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://127.0.0.1:4318/v1/traces` in `server/.env`.
4. Start the API, then run:

   ```sh
   cd observability
   docker compose --env-file .env -f docker-compose.yml up -d
   ```

- Grafana: <http://localhost:3000>
- Prometheus: <http://localhost:9090/targets>
- Dashboard: **PadosiPro → PadosiPro API Overview**
- Traces: Grafana → **Explore → Tempo → Search**

Stop monitoring with:

```sh
docker compose --env-file .env -f docker-compose.yml down
```

### If the API runs on the same server as monitoring

Set the API's trace endpoint to:

```text
http://host.docker.internal:4318/v1/traces
```

### If the API and monitoring run on separate servers

- Set `PROMETHEUS_API_TARGET` to the API server's private IP and port, for example `10.0.0.5:4000`.
- Set the API's trace endpoint to `http://<monitoring-server-private-ip>:4318/v1/traces`.
- Set `MONITORING_BIND_ADDRESS` to the monitoring server's private IP.
- Allow monitoring ports only between your private servers. **Do not expose port `4318` to the public internet**, because Tempo has no built-in authentication.
