#!/bin/sh
# Genera config.json da KEYCLOAK_ORIGIN a startup del container: la stessa
# immagine gira invariata su locale/ci/remote (onepiece-infrastructure
# helm/charts/user-frontend inietta KEYCLOAK_ORIGIN solo in "remote"), solo
# questo file cambia - vedi docs/adr/0001-runtime-config-injection.md.
#
# Eseguito automaticamente dall'entrypoint di nginx:stable-alpine (script in
# /docker-entrypoint.d/, ordine lessicografico). "envsubst" è già incluso in
# quell'immagine (lo usa il suo stesso script 20-envsubst-on-templates.sh),
# nessuna dipendenza aggiuntiva.
set -eu

envsubst '${KEYCLOAK_ORIGIN}' \
  < /usr/share/nginx/html/config.json.template \
  > /usr/share/nginx/html/config.json
