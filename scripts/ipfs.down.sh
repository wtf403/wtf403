#!/bin/bash

# Stop services
systemctl stop ipfs-cluster
systemctl stop ipfs
systemctl disable ipfs-cluster
systemctl disable ipfs

# Remove systemd services
rm -f /etc/systemd/system/ipfs.service
rm -f /etc/systemd/system/ipfs-cluster.service
systemctl daemon-reload

# Remove binaries
rm -f /usr/local/bin/ipfs
rm -f /usr/local/bin/ipfs-cluster-service
rm -f /usr/local/bin/ipfs-cluster-ctl

# Remove data directories
rm -rf ~/.ipfs
rm -rf ~/.ipfs-cluster

# Clean up any temporary files
rm -f /tmp/kubo_*.tar.gz
rm -f /tmp/ipfs-cluster-*.tar.gz
rm -rf /tmp/kubo
rm -rf /tmp/ipfs-cluster-service
rm -rf /tmp/ipfs-cluster-ctl

echo "IPFS and IPFS Cluster have been removed from the system"
