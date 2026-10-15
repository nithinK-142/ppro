#!/bin/sh
set -eu

sed \
  -e "s|__METRICS_TOKEN__|${METRICS_TOKEN}|g" \
  -e "s|__PROMETHEUS_API_TARGET__|${PROMETHEUS_API_TARGET:-host.docker.internal:4000}|g" \
  /etc/prometheus/prometheus.yml.tmpl > /tmp/prometheus.yml

exec /bin/prometheus \
  --config.file=/tmp/prometheus.yml \
  --storage.tsdb.path=/prometheus \
  --storage.tsdb.retention.time=15d \
  --storage.tsdb.retention.size=5GB
