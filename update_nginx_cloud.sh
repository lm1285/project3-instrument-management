#!/bin/bash

# Define the config file path
CONFIG_FILE="/etc/nginx/conf.d/wzglpt.conf"

# Backup existing config
if [ -f "$CONFIG_FILE" ]; then
    cp "$CONFIG_FILE" "${CONFIG_FILE}.bak_$(date +%Y%m%d_%H%M%S)"
    echo "Backed up existing config to ${CONFIG_FILE}.bak_..."
fi

# Write new config
cat > "$CONFIG_FILE" <<EOF
server {
    listen 80;
    server_name wzglpt.top www.wzglpt.top;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name wzglpt.top www.wzglpt.top;

    ssl_certificate /etc/nginx/cert/wzglpt.top.pem;
    ssl_certificate_key /etc/nginx/cert/wzglpt.top.key;

    ssl_session_timeout 5m;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE:ECDH:AES:HIGH:!NULL:!aNULL:!MD5:!ADH:!RC4;
    ssl_protocols TLSv1.1 TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    root /var/www/wzglpt;
    index index.html;

    # 1. Excel Add-in (Static files proxy)
    location /excel-addin/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Disable cache for development/updates
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # 2. Backend API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # 3. Frontend Assets
    location /assets/ {
        try_files \$uri =404;
        access_log off;
        expires 7d;
    }

    # 4. Index HTML No-Cache
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # 5. Frontend SPA Catch-all
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

echo "Nginx configuration updated."

# Test configuration
echo "Testing Nginx configuration..."
nginx -t

if [ \$? -eq 0 ]; then
    echo "Configuration test passed. Reloading Nginx..."
    nginx -s reload
    echo "Nginx reloaded successfully."
else
    echo "Configuration test failed! Please check the output above."
    # Restore backup? Maybe not automatically to avoid confusion, let user decide.
fi
