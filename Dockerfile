## start from the official image for PostgreSQL and just add the extension
FROM postgres:17-bookworm
ARG VERSION=3.0.1

# install the extension
COPY pg_rest_pg17-${VERSION}_aarch64.deb .
COPY pg_rest_pg17-${VERSION}_amd64.deb .
RUN export ARCH=$(uname -m) && \
    echo "ARCH: $ARCH" && \
    # Map architecture names to package names
    if [ "$ARCH" = "x86_64" ]; then \
        PACKAGE_ARCH="amd64"; \
    else \
        PACKAGE_ARCH="$ARCH"; \
    fi && \
    echo "Using package architecture: $PACKAGE_ARCH" && \
    apt-get update && \
    apt-get install -y ./pg_rest_pg17-${VERSION}_${PACKAGE_ARCH}.deb