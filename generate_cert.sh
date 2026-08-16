#!/usr/bin/env bash
set -e

CERT_DIR="./frontend/certs"
mkdir -p "$CERT_DIR"

get_ip() {
  if command -v ip >/dev/null 2>&1; then
    ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") {print $(i+1); exit}}'
    return
  fi

  if command -v ipconfig >/dev/null 2>&1; then
    for iface in en0 en1 en2; do
      ipconfig getifaddr "$iface" 2>/dev/null && return
    done
  fi

  if command -v ifconfig >/dev/null 2>&1; then
    ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}'
  fi
}

# 1) Get machine IP (portable across Linux and macOS)
IP=$(get_ip)

if [ -z "$IP" ]; then
  IP="localhost"
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
DNS.1 = localhost
DNS.2 = host.docker.internal
EOF

VALUE="FRONTEND_URL=https://$IP:8080"

# If key exists → replace
if [ -f ".env" ] && grep -q "^FRONTEND_URL=" ".env"; then
  TMP_ENV=$(mktemp)
  awk -v value="$VALUE" 'BEGIN { replaced = 0 } /^FRONTEND_URL=/ { print value; replaced = 1; next } { print } END { if (!replaced) print value }' ".env" > "$TMP_ENV"
  mv "$TMP_ENV" ".env"
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

