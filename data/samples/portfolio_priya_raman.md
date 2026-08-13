# Priya Raman

Senior backend engineer, six years building event-driven data platforms on Azure.
I care about systems that stay debuggable at 3am.

## Skills

- Python, Go, SQL
- Azure Functions, Cosmos DB, Kafka, Airflow
- Kubernetes, Docker, Terraform
- Observability with Prometheus and Grafana

## Experience

### Northwind Logistics - Senior Backend Engineer (2022-present)

- Rebuilt the shipment tracking ingestion pipeline from a nightly batch job to an event-driven system on Azure Functions and Kafka, cutting end-to-end latency from 6 hours to under 90 seconds.
- Designed the Cosmos DB partitioning strategy for 40 million shipment records after the original single-partition design started throttling at peak.
- Led the migration of 14 services from a shared Postgres instance to per-service databases over two quarters, with zero unplanned downtime.
- Introduced consumer-driven contract testing that caught 23 breaking API changes before release.
- Own the on-call runbook for the tracking platform; reduced page volume by 60% by fixing the three alerts that produced most of the noise.

### Ravensbourne Analytics - Backend Engineer (2019-2022)

- Built the Airflow DAGs behind the customer reporting product, processing about 2 TB per day.
- Wrote the deduplication service in Go that removed roughly 8% duplicate records from the warehouse feed.
- Added Prometheus instrumentation and Grafana dashboards across 9 services.

## Projects

- **kafka-replay** - an open source CLI for replaying Kafka topics into a local sink for debugging. Around 400 GitHub stars.
- **cosmos-partition-lint** - a small linter that flags Cosmos DB partition keys likely to produce hot partitions.

## Education

BSc Computer Science, University of Manchester, 2019.
