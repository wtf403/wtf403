#!/usr/bin/env bash

if ! command -v jq >/dev/null 2>&1; then
    apt-get update && apt-get install -y jq
fi

IPFS_VERSION="v0.34.1"
CLUSTER_VERSION="v1.1.2"
BOOTSTRAP_SERVER=
CLUSTER_USER=
CLUSTER_PASSWORD=

# FOR REGULAR (NOT BOOTSTRAP) NODE:
CLUSTER_SECRET=
CLUSTER_ID=

MULTIADDR="/ip4/${BOOTSTRAP_SERVER}/tcp/9096/p2p/${CLUSTER_ID}"

# Simple bootstrap check - if any of the required vars are missing, it's a bootstrap node
if [ -z "$CLUSTER_SECRET" ] || [ -z "$CLUSTER_ID" ] || [ -z "$BOOTSTRAP_SERVER" ]; then
    IS_BOOTSTRAP=true
    CLUSTER_SECRET=$(openssl rand -hex 32)
    BOOTSTRAP_SERVER=$(hostname -I | awk '{print $1}')
else
    IS_BOOTSTRAP=false
fi

echo "Mode: $([ "$IS_BOOTSTRAP" = true ] && echo "Bootstrap Node" || echo "Regular Node")"
echo "Bootstrap Server: ${BOOTSTRAP_SERVER}"

# Check if IPFS is already installed and running
IPFS_RUNNING=false
if /usr/local/bin/ipfs >/dev/null 2>&1; then
    echo "IPFS is already installed"
    if pgrep -f "ipfs daemon" >/dev/null; then
        echo "IPFS is already running"
        IPFS_RUNNING=true
    else
        echo "IPFS is installed but not running"
    fi
else
    echo "Installing IPFS..."
    cd /tmp
    IPFS_ARCHIVE="kubo_${IPFS_VERSION}_linux-amd64.tar.gz"
    if [ ! -f "$IPFS_ARCHIVE" ]; then
        echo "Downloading IPFS archive..."
        wget https://dist.ipfs.tech/kubo/${IPFS_VERSION}/${IPFS_ARCHIVE}
    else
        echo "Using existing IPFS archive..."
    fi
    tar -xvzf ${IPFS_ARCHIVE}
    mv kubo/ipfs /usr/local/bin/
    ipfs init
    ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
    ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8088
    ipfs config --json DNS.Resolvers '{"eth.": "https://dns.eth.limo/dns-query"}'
fi

# Check if IPFS Cluster is already installed
CLUSTER_RUNNING=false
if /usr/local/bin/ipfs-cluster-service >/dev/null 2>&1; then
    echo "IPFS Cluster is already installed"
    if pgrep -f "ipfs-cluster-service daemon" >/dev/null; then
        echo "IPFS Cluster is already running"
        CLUSTER_RUNNING=true
    else
        echo "IPFS Cluster is installed but not running"
    fi
else
    echo "Installing IPFS Cluster..."
    cd /tmp
    CLUSTER_SERVICE_ARCHIVE="ipfs-cluster-service_${CLUSTER_VERSION}_linux-amd64.tar.gz"
    CLUSTER_CTL_ARCHIVE="ipfs-cluster-ctl_${CLUSTER_VERSION}_linux-amd64.tar.gz"

    if [ ! -f "$CLUSTER_SERVICE_ARCHIVE" ]; then
        echo "Downloading IPFS Cluster Service archive..."
        wget https://dist.ipfs.tech/ipfs-cluster-service/${CLUSTER_VERSION}/${CLUSTER_SERVICE_ARCHIVE}
    else
        echo "Using existing IPFS Cluster Service archive..."
    fi

    if [ ! -f "$CLUSTER_CTL_ARCHIVE" ]; then
        echo "Downloading IPFS Cluster Control archive..."
        wget https://dist.ipfs.tech/ipfs-cluster-ctl/${CLUSTER_VERSION}/${CLUSTER_CTL_ARCHIVE}
    else
        echo "Using existing IPFS Cluster Control archive..."
    fi

    tar -xvzf ${CLUSTER_SERVICE_ARCHIVE}
    tar -xvzf ${CLUSTER_CTL_ARCHIVE}
    mv ipfs-cluster-service/ipfs-cluster-service /usr/local/bin/
    mv ipfs-cluster-ctl/ipfs-cluster-ctl /usr/local/bin/
    chmod +x /usr/local/bin/ipfs-cluster-service
    chmod +x /usr/local/bin/ipfs-cluster-ctl
fi

if [ "$IS_BOOTSTRAP" = false ]; then
    ipfs bootstrap rm --all
    ipfs bootstrap add "$MULTIADDR"
fi

cat > /etc/systemd/system/ipfs.service << EOF
[Unit]
Description=IPFS Daemon
After=network.target

[Service]
Environment=IPFS_PATH=/root/.ipfs
ExecStart=/usr/local/bin/ipfs daemon
ExecStartPost=/bin/sh -c 'while ! curl -s http://127.0.0.1:5001/api/v0/id > /dev/null; do sleep 1; done'
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

if [ "$IS_BOOTSTRAP" = false ]; then
    EXEC_CMD="/usr/local/bin/ipfs-cluster-service daemon -j $MULTIADDR"
else
    EXEC_CMD="/usr/local/bin/ipfs-cluster-service daemon"
fi

cat > /etc/systemd/system/ipfs-cluster.service << EOF
[Unit]
Description=IPFS Cluster Daemon
After=ipfs.service
Requires=ipfs.service

[Service]
Environment=CLUSTER_SECRET=${CLUSTER_SECRET}
ExecStartPre=/bin/sh -c 'until curl -s http://127.0.0.1:5001/api/v0/id > /dev/null; do sleep 1; done'
ExecStart=${EXEC_CMD}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Initialize and configure cluster
if [ ! -d ~/.ipfs-cluster ]; then
    ipfs-cluster-service init -f
    if [ "$IS_BOOTSTRAP" = false ]; then
        # Regular Node
        jq --arg addr "$MULTIADDR" --arg secret "$CLUSTER_SECRET" '
            .cluster.bootstrap = [$addr] |
            .cluster.secret = $secret |
            .cluster.disable_repinning = false |
            .cluster.peer_watch_interval = "10s" |
            .cluster.dial_peer_timeout = "3m0s" |
            .cluster.connection_manager.high_water = 400 |
            .cluster.connection_manager.low_water = 100 |
            .ipfs.node_multiaddress = "/ip4/127.0.0.1/tcp/5001" |
            .api.restapi.http_listen_multiaddress = "/ip4/0.0.0.0/tcp/9094" |
            .ipfs.proxy_listen_multiaddress = "/ip4/0.0.0.0/tcp/9095"
        ' ~/.ipfs-cluster/service.json > ~/.ipfs-cluster/service.json.tmp
        mv ~/.ipfs-cluster/service.json.tmp ~/.ipfs-cluster/service.json

        jq --arg user "$CLUSTER_USER" --arg pass "$CLUSTER_PASSWORD" \
          '.api.restapi.basic_auth_credentials = {($user): $pass}' \
          ~/.ipfs-cluster/service.json > ~/.ipfs-cluster/service.json.tmp
        mv ~/.ipfs-cluster/service.json.tmp ~/.ipfs-cluster/service.json
    else
        # Bootstrap Node
        jq '
            .cluster.bootstrap = [] |
            .cluster.disable_repinning = false |
            .cluster.peer_watch_interval = "10s" |
            .cluster.dial_peer_timeout = "3m0s" |
            .cluster.connection_manager.high_water = 400 |
            .cluster.connection_manager.low_water = 100 |
            .ipfs.node_multiaddress = "/ip4/127.0.0.1/tcp/5001" |
            .api.restapi.http_listen_multiaddress = "/ip4/0.0.0.0/tcp/9094" |
            .ipfs.proxy_listen_multiaddress = "/ip4/0.0.0.0/tcp/9095"
        ' ~/.ipfs-cluster/service.json > ~/.ipfs-cluster/service.json.tmp
        mv ~/.ipfs-cluster/service.json.tmp ~/.ipfs-cluster/service.json

        jq --arg user "$CLUSTER_USER" --arg pass "$CLUSTER_PASSWORD" \
          '.api.restapi.basic_auth_credentials = {($user): $pass}' \
          ~/.ipfs-cluster/service.json > ~/.ipfs-cluster/service.json.tmp
        mv ~/.ipfs-cluster/service.json.tmp ~/.ipfs-cluster/service.json
    fi
fi

# Start services only if they're not running
if ! $IPFS_RUNNING; then
    systemctl daemon-reload
    systemctl enable ipfs
    systemctl start ipfs
    echo "Waiting for IPFS daemon to be ready..."
    until curl -s http://127.0.0.1:5001/api/v0/id > /dev/null; do
        sleep 1
    done
fi

if ! $CLUSTER_RUNNING; then
    systemctl enable ipfs-cluster
    systemctl start ipfs-cluster
    echo "Waiting for IPFS Cluster to start..."
    sleep 5
fi

echo "Checking Cluster Status:"

# Check IPFS daemon status
echo "IPFS Daemon Status:"
systemctl status ipfs | grep "Active:"
ipfs swarm peers

echo "============================================"
# Check IPFS Cluster status
echo -e "\nIPFS Cluster Status:"
systemctl status ipfs-cluster | grep "Active:"
ipfs-cluster-ctl peers ls
ipfs-cluster-ctl status

# Check service logs for any errors
echo -e "\nRecent IPFS Cluster Logs:"
journalctl -u ipfs-cluster -n 10 --no-pager

echo -e "\nRecent IPFS Logs:"
journalctl -u ipfs -n 10 --no-pager
echo "============================================"

# Print cluster information
echo "Installation Complete!"
if [ "$IS_BOOTSTRAP" = true ]; then
    echo "CLUSTER_SECRET=${CLUSTER_SECRET}"
    echo "CLUSTER_ID=$(grep -o '"id": "[^"]*' ~/.ipfs-cluster/identity.json | cut -d'"' -f4)"
    echo "BOOTSTRAP_SERVER=${BOOTSTRAP_SERVER}"
    # Output cluster connection details
    echo "CLUSTER_MULTIADDR=${MULTIADDR}"
    echo "CLUSTER_USER=${CLUSTER_USER}"
    echo "CLUSTER_PASSWORD=${CLUSTER_PASSWORD}"
fi

echo "============================================"

# Cleanup
rm -rf /tmp/kubo
rm -rf /tmp/ipfs-cluster-service
rm -rf /tmp/ipfs-cluster-ctl
