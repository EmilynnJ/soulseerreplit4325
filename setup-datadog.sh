#!/bin/bash

# Datadog monitoring setup script for SoulSeer Render PostgreSQL database
echo "Setting up Datadog monitoring for Render PostgreSQL database..."

# Run Datadog agent with correct configuration
docker run -d --name dd-agent \
  -e DD_API_KEY=2800d42635d135d6005533e5d5803540 \
  -e DD_SITE="us5.datadoghq.com" \
  -e DD_DOGSTATSD_NON_LOCAL_TRAFFIC=true \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /proc/:/host/proc/:ro \
  -v /sys/fs/cgroup/:/host/sys/fs/cgroup:ro \
  -v /var/lib/docker/containers:/var/lib/docker/containers:ro \
  gcr.io/datadoghq/agent:7

# Check if the agent is running
echo "Checking Datadog agent status..."
sleep 5
docker ps | grep dd-agent

# Add PostgreSQL integration configuration
echo "Configuring PostgreSQL monitoring..."
docker exec dd-agent bash -c "echo '
init_config:

instances:
  - host: dpg-cvsgi9i4d50c738gkhu0-a.ohio-postgres.render.com
    port: 5432
    username: soulseer_user
    password: GCsZBgUkiEPgjNf08OTXLhvyP0kPvYI6
    dbname: soulseer
    tags:
      - service:soulseer
      - env:production
' > /etc/datadog-agent/conf.d/postgres.d/conf.yaml"

# Restart the agent to apply changes
echo "Restarting Datadog agent to apply configuration..."
docker restart dd-agent

echo "Datadog monitoring setup complete!"
echo "PostgreSQL database metrics will now be available in your Datadog dashboard."