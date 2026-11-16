# Local Fleet registry for the connector catalog PoC

This folder holds a fixture Fleet package and a script to serve it from a local package registry.

The `connectorCatalogFleet` plugin fetches the package from Fleet (no install) and hands the YAML specs to `actions`.

## Package

Source: `fleet_package/kibana_connector_specs/1.0.0/`

- `type: content`, `format_version: 3.4.0` (Fleet accepts spec 2.3 to 3.7).
- `conditions.elastic.subscription: enterprise`.
- 1 spec: `connector_specs/fleet_poc_okta.yaml` (id `.fleet_poc_okta`).

Entries in the built zip:

```
kibana_connector_specs-1.0.0/changelog.yml
kibana_connector_specs-1.0.0/docs/README.md
kibana_connector_specs-1.0.0/manifest.yml
kibana_connector_specs-1.0.0/connector_specs/fleet_poc_okta.yaml
```

The spec is the okta fixture from `actions` with a new id and displayName, without the `icon` block, and without `auth.types[0].prefix` (the parser rejects it).

## Run the registry

With Docker (default, port 8080):

```sh
x-pack/platform/plugins/shared/connector_catalog_fleet/dev/run_local_registry.sh
```

Without Docker (native registry binary):

```sh
GOBIN=$HOME/go/bin go install github.com/elastic/package-registry@latest
RUNTIME=native x-pack/platform/plugins/shared/connector_catalog_fleet/dev/run_local_registry.sh
```

The script:

1. Zips the package as `kibana_connector_specs-1.0.0.zip`.
2. Signs it with the Fleet test key (`x-pack/platform/test/fleet_api_integration/apis/fixtures/package_verification/signatures/`, passphrase `test`). It uses gpg with a temp `GNUPGHOME`, or `openpgp` from `node_modules` when gpg is missing.
3. Starts the registry with the zip and `.sig` mounted.

Options: `PORT`, `OUT_DIR`, `RUNTIME`, `EPR_BIN`, `IMAGE`, `BUILD_ONLY=true`. See the header of the script.

In Docker mode, the registry also serves the packages baked into the image. In native mode, it serves only this package.

## Check the registry

```sh
curl 'http://localhost:8080/search?package=kibana_connector_specs'
curl 'http://localhost:8080/package/kibana_connector_specs/1.0.0/'
curl -O 'http://localhost:8080/epr/kibana_connector_specs/kibana_connector_specs-1.0.0.zip'
curl -O 'http://localhost:8080/epr/kibana_connector_specs/kibana_connector_specs-1.0.0.zip.sig'
```

## kibana.dev.yml

```yaml
xpack.fleet.registryUrl: http://localhost:8080
xpack.fleet.packageVerification.gpgKeyPath: x-pack/platform/test/fleet_api_integration/apis/fixtures/package_verification/signatures/fleet_test_key_public.asc
xpack.connectorCatalogFleet.enabled: true
feature_flags.overrides:
  actions.connectorCatalogEnabled: true
```

The relative `gpgKeyPath` resolves from the Kibana root. Use an absolute path if Kibana starts from another folder.

The spec needs an enterprise license (`minimumLicense: enterprise`). Start a trial license to use the connector type.
