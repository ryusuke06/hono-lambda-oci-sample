# hono-lambda-oci-sample

Sample Hono app packaged with Paketo Cloud Native Buildpacks, intended to run on AWS Lambda Container Image with Lambda Web Adapter.

## Endpoints

- `GET /` — JSON response with runtime metadata (pid, bootTime, requestCount, AWS env vars)
- `GET /healthz` — health probe

## Build

```sh
pack build my-app:cnb --path . --builder paketobuildpacks/builder-jammy-base
```

## Local run

```sh
pnpm install
pnpm build
pnpm start
# http://localhost:8080/
```
