# Security Policy

## Reporting A Vulnerability

Report suspected vulnerabilities privately to <security@borgels.com>.

Include a concise description, affected package/version, reproduction steps,
and impact where possible.

## Scope Note

This server is read-only and holds no credentials, no user identity, and no
personal data. It queries public food databases (Open Food Facts) and reads a
bundled public dataset (DTU Frida). There is no write path to any upstream
service and no per-user state to compromise.

The optional `MCP_HTTP_TOKEN` protects the HTTP transport itself; keep it
secret if the server is exposed beyond loopback.

## Supported Versions

Security fixes target the latest `main` branch.
