#!/bin/bash
cd "$(dirname "$0")"
set -a
source .env
set +a
exec ngrok http "${PORT:-3000}" --url="$NGROK_DOMAIN" --log=stdout
