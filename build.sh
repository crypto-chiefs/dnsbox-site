#!/bin/bash

set -e

echo "Building Go backend (Go 1.24 or later)..."
go test main.go main_test.go
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o app main.go

echo "Building frontend..."
yarn install --frozen-lockfile
yarn build
yarn run check

echo "Done."
