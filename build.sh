#!/bin/bash

set -e

echo "🚀 Building Go backend..."
GOOS=linux GOARCH=amd64 go build -o app main.go

echo "🎨 Building frontend with yarn..."
yarn install --frozen-lockfile
yarn build

echo "✅ Done."
