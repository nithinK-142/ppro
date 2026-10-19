# Observability

Prometheus collects API metrics. Grafana displays metrics and traces. Tempo stores request traces.

## What is collected

HTTP counts, status codes, latency, 5xx responses, in-flight requests, process memory/CPU, event-loop lag, PostgreSQL timings/errors, and HTTP/PostgreSQL traces. Route labels use route templates; request bodies, query strings, authorization headers, SQL text, parameters, user IDs, and emails are not recorded.

Prometheus retains 15 days or 5 GB of metrics. Tempo retains trace blocks for 48 hours. The alert rules detect API scrape failures, sustained 5xx rates, and high p95 latency. Rules do not send notifications until an Alertmanager or Grafana contact point is configured.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `METRICS_TOKEN` and `GRAFANA_ADMIN_PASSWORD`. Use the same metrics token in `server/.env` and `observability/.env`.
3. Set `OBSERVABILITY_ENABLED=true` and `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://127.0.0.1:4318/v1/traces` in `server/.env`.
4. Start the monitoring stack separately, then start the API:

   ```sh
   cd observability
   docker compose up -d
   ```

- Grafana: <http://localhost:3000>
- Prometheus: <http://localhost:9090/targets>
- Dashboard: **PadosiPro → PadosiPro API Overview**
- Traces: Grafana → **Explore → Tempo → Search**

To disable application telemetry, set `OBSERVABILITY_ENABLED=false` in `server/.env` and restart the API. Set it back to `true` to resume collection. The monitoring containers keep running until stopped separately with `docker compose down` from this directory. Do not use `docker compose down -v`; that would delete stored metrics, traces, and Grafana data.

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
