#!/usr/bin/env bash
set -e

CERT_DIR="./frontend/certs"
mkdir -p "$CERT_DIR"

# 1) Get machine IP (pick first non-loopback IPv4)
IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") {print $(i+1); exit}}')

if [ -z "$IP" ]; then
  # fallback: hostname -I
  IP=$(hostname -I | awk '{print $1}')
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

# If key exists → replace
if grep -q "^FRONTEND_URL=" ".env"; then
  sed -i "s|^FRONTEND_URL=.*|$VALUE|" ".env"
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

