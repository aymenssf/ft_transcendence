#!/usr/bin/env bash
set -e

CERT_DIR="./frontend/certs"
mkdir -p "$CERT_DIR"

# 1) Get machine IP (macOS compatible)
# Try to get the IP from the default network interface
if command -v ipconfig &> /dev/null; then
  # macOS: get IP from default route interface
  DEFAULT_IFACE=$(route -n get default 2>/dev/null | awk '/interface:/ {print $2}')
  if [ -n "$DEFAULT_IFACE" ]; then
    IP=$(ipconfig getifaddr "$DEFAULT_IFACE" 2>/dev/null)
  fi
fi

# Fallback: try ifconfig parsing
if [ -z "$IP" ]; then
  IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
fi

if [ -z "$IP" ]; then
  echo "❌ Could not determine IP address"
  exit 1
fi

echo "✅ Using IP: $IP"

SAN_CFG="$CERT_DIR/san.cnf"

cat > "$SAN_CFG" <<EOF
[ req ]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[ req_distinguished_name ]
CN = $IP

[ v3_req ]
subjectAltName = @alt_names

[ alt_names ]
IP.1 = $IP
EOF

VALUE="FRONTEND_URL=https://$IP:8080"

# If key exists → replace (macOS compatible)
if grep -q "^FRONTEND_URL=" ".env"; then
  sed -i '' "s|^FRONTEND_URL=.*|$VALUE|" ".env"
else
  # Otherwise append
  echo "$VALUE" >> ".env"
fi

# 2) Generate key + cert (self-signed)
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.crt" \
  -config "$SAN_CFG"

echo "✅ Cert generated in $CERT_DIR/server.crt with SAN IP $IP"

