#!/usr/bin/env bash
#
# Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
# or more contributor license agreements. Licensed under the Elastic License
# 2.0; you may not use this file except in compliance with the Elastic License
# 2.0.
#
# Builds the kibana_connector_specs fixture package as a zip, signs it with the
# Fleet test GPG key, and serves it from a local package registry.
#
# Usage (from anywhere):
#   x-pack/platform/plugins/shared/connector_catalog_fleet/dev/run_local_registry.sh
#
# Environment:
#   PORT     Host port for the registry. Default: 8080.
#   OUT_DIR  Where the zip, .sig and registry config are written.
#            Default: ${TMPDIR:-/tmp}/kibana_connector_specs_registry
#   RUNTIME  docker (default) or native.
#            native runs a local package-registry binary instead of Docker:
#              GOBIN=$HOME/go/bin go install github.com/elastic/package-registry@latest
#   EPR_BIN  Path to the package-registry binary for RUNTIME=native.
#            Default: package-registry on PATH, then $HOME/go/bin/package-registry.
#   IMAGE    Registry image for RUNTIME=docker.
#            Default: docker.elastic.co/kibana-ci/package-registry-distribution:lite
#   BUILD_ONLY=true  Build and sign the zip, then exit.
#
# Signing uses gpg when it is installed. Without gpg, it falls back to the
# openpgp library from the Kibana node_modules (same key, same detached
# armored signature format).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIBANA_ROOT="$(cd "${SCRIPT_DIR}/../../../../../.." && pwd)"

PKG_NAME="kibana_connector_specs"
PKG_VERSION="1.0.0"
PKG_SRC="${SCRIPT_DIR}/fleet_package/${PKG_NAME}/${PKG_VERSION}"
KEY_DIR="${KIBANA_ROOT}/x-pack/platform/test/fleet_api_integration/apis/fixtures/package_verification/signatures"
PRIVATE_KEY="${KEY_DIR}/fleet_test_key_private.asc"
PUBLIC_KEY="${KEY_DIR}/fleet_test_key_public.asc"
KEY_PASSPHRASE="test"

PORT="${PORT:-8080}"
OUT_DIR="${OUT_DIR:-${TMPDIR:-/tmp}/kibana_connector_specs_registry}"
RUNTIME="${RUNTIME:-docker}"
IMAGE="${IMAGE:-docker.elastic.co/kibana-ci/package-registry-distribution:lite}"
CONTAINER_NAME="kibana-connector-specs-registry"

PACKAGES_DIR="${OUT_DIR}/packages"
ZIP_PATH="${PACKAGES_DIR}/${PKG_NAME}-${PKG_VERSION}.zip"
SIG_PATH="${ZIP_PATH}.sig"

log() {
  echo "[run_local_registry] $*"
}

build_zip() {
  local staging
  staging="$(mktemp -d)"
  # The registry and Fleet expect every entry under a "<name>-<version>/" root folder.
  cp -R "${PKG_SRC}" "${staging}/${PKG_NAME}-${PKG_VERSION}"
  find "${staging}" -name '.DS_Store' -delete
  rm -rf "${PACKAGES_DIR}"
  mkdir -p "${PACKAGES_DIR}"
  (cd "${staging}" && zip -rqX "${ZIP_PATH}" "${PKG_NAME}-${PKG_VERSION}")
  rm -rf "${staging}"
  log "Built ${ZIP_PATH}"
}

sign_with_gpg() {
  local gnupg_home
  gnupg_home="$(mktemp -d)"
  chmod 700 "${gnupg_home}"
  GNUPGHOME="${gnupg_home}" gpg --batch --quiet --import "${PRIVATE_KEY}"
  GNUPGHOME="${gnupg_home}" gpg --batch --yes --quiet \
    --pinentry-mode loopback --passphrase "${KEY_PASSPHRASE}" \
    --armor --detach-sign --output "${SIG_PATH}" "${ZIP_PATH}"
  GNUPGHOME="${gnupg_home}" gpg --batch --quiet --verify "${SIG_PATH}" "${ZIP_PATH}"
  rm -rf "${gnupg_home}"
}

sign_with_openpgp() {
  (cd "${KIBANA_ROOT}" && node -e "
    const fs = require('fs');
    const openpgp = require('openpgp');
    const [zipPath, sigPath, privateKeyPath, publicKeyPath, passphrase] = process.argv.slice(1);
    (async () => {
      const privateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: fs.readFileSync(privateKeyPath, 'utf8') }),
        passphrase,
      });
      const message = await openpgp.createMessage({ binary: fs.readFileSync(zipPath) });
      const signature = await openpgp.sign({ message, signingKeys: privateKey, detached: true, format: 'armored' });
      fs.writeFileSync(sigPath, signature);
      const { signatures } = await openpgp.verify({
        message,
        signature: await openpgp.readSignature({ armoredSignature: signature }),
        verificationKeys: await openpgp.readKey({ armoredKey: fs.readFileSync(publicKeyPath, 'utf8') }),
      });
      await signatures[0].verified;
    })().catch((error) => { console.error(error); process.exit(1); });
  " "${ZIP_PATH}" "${SIG_PATH}" "${PRIVATE_KEY}" "${PUBLIC_KEY}" "${KEY_PASSPHRASE}")
}

sign_zip() {
  if command -v gpg > /dev/null 2>&1; then
    sign_with_gpg
    log "Signed with gpg: ${SIG_PATH}"
  else
    log "gpg not found, signing with openpgp from Kibana node_modules"
    sign_with_openpgp
    log "Signed with openpgp: ${SIG_PATH}"
  fi
}

write_config() {
  local packages_path="$1"
  shift
  {
    echo "package_paths:"
    echo "  - ${packages_path}"
    for extra_path in "$@"; do
      echo "  - ${extra_path}"
    done
  } > "${OUT_DIR}/config.yml"
}

run_docker() {
  # /packages/package-storage is the package set baked into the lite image.
  write_config /packages/connector-specs /packages/package-storage
  docker rm -f "${CONTAINER_NAME}" > /dev/null 2>&1 || true
  log "Starting ${IMAGE} as ${CONTAINER_NAME} on http://localhost:${PORT}"
  exec docker run --rm --name "${CONTAINER_NAME}" \
    -p "${PORT}:8080" \
    -v "${OUT_DIR}/config.yml:/package-registry/config.yml:ro" \
    -v "${PACKAGES_DIR}:/packages/connector-specs:ro" \
    "${IMAGE}"
}

run_native() {
  local epr_bin="${EPR_BIN:-}"
  if [[ -z "${epr_bin}" ]]; then
    epr_bin="$(command -v package-registry || echo "${HOME}/go/bin/package-registry")"
  fi
  if [[ ! -x "${epr_bin}" ]]; then
    echo "package-registry binary not found. Install it with:" >&2
    echo "  GOBIN=\$HOME/go/bin go install github.com/elastic/package-registry@latest" >&2
    exit 1
  fi
  write_config "${PACKAGES_DIR}"
  log "Starting ${epr_bin} on http://localhost:${PORT}"
  cd "${OUT_DIR}"
  exec "${epr_bin}" -config "${OUT_DIR}/config.yml" -address "0.0.0.0:${PORT}"
}

mkdir -p "${OUT_DIR}"
build_zip
sign_zip

if [[ "${BUILD_ONLY:-false}" == "true" ]]; then
  exit 0
fi

case "${RUNTIME}" in
  docker) run_docker ;;
  native) run_native ;;
  *)
    echo "Unknown RUNTIME '${RUNTIME}'. Use docker or native." >&2
    exit 1
    ;;
esac
