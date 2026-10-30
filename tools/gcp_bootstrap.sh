#!/usr/bin/env bash
# Prepares a Google Cloud project to receive deploys from GitHub (ADR-0007).
# Run it yourself in Cloud Shell, once. Running it again is safe: it skips what already exists.
#
#   bash tools/gcp_bootstrap.sh PROJECT_ID [REGION] [GITHUB_REPO]
#
# It asks for the Neon connection string without showing it, and generates the Django
# secret key itself. Neither value is printed, logged or stored outside Secret Manager.
set -euo pipefail

PROJECT_ID="${1:?Usage: bash tools/gcp_bootstrap.sh PROJECT_ID [REGION] [GITHUB_REPO]}"
REGION="${2:-southamerica-east1}"
REPO="${3:-aleharo2003/floky-cuadernos}"
POOL=github
PROVIDER=github-oidc
DEPLOY_SA="cuadernos-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
RUNTIME_SA="cuadernos-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

say() { printf '\n== %s\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }

gcloud config set project "$PROJECT_ID" >/dev/null
NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

say "Turning on the APIs"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com cloudresourcemanager.googleapis.com

say "Image registry (keeps the last 5 images, to stay inside the free storage)"
if ! exists gcloud artifacts repositories describe cuadernos --location "$REGION"; then
  gcloud artifacts repositories create cuadernos --repository-format docker --location "$REGION" \
    --description "Cuadernos images"
fi
policy=$(mktemp)
cat > "$policy" <<'JSON'
[
  {"name": "keep-last-5", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 5}},
  {"name": "delete-older", "action": {"type": "Delete"}, "condition": {"tagState": "any", "olderThan": "1d"}}
]
JSON
gcloud artifacts repositories set-cleanup-policies cuadernos --location "$REGION" --policy "$policy" --no-dry-run
rm -f "$policy"

say "Service accounts: one for GitHub to deploy, one for the app to run"
exists gcloud iam service-accounts describe "$DEPLOY_SA" ||
  gcloud iam service-accounts create cuadernos-deployer --display-name "Cuadernos: deploys from GitHub"
exists gcloud iam service-accounts describe "$RUNTIME_SA" ||
  gcloud iam service-accounts create cuadernos-runtime --display-name "Cuadernos: the running app"

for role in roles/run.admin roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$DEPLOY_SA" --role "$role" \
    --condition None --quiet >/dev/null
done
# The deployer may start services as the runtime account, and nothing more.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --member "serviceAccount:$DEPLOY_SA" \
  --role roles/iam.serviceAccountUser --quiet >/dev/null

say "Secrets"
if ! exists gcloud secrets describe database-url; then
  echo "Paste the Neon connection string (direct, not pooled). It will not be shown:"
  read -rs DB_URL
  [ -n "$DB_URL" ] || { echo "Empty value, stopping." >&2; exit 1; }
  printf '%s' "$DB_URL" | gcloud secrets create database-url --replication-policy automatic --data-file=-
  unset DB_URL
else
  echo "database-url already exists. To change it: gcloud secrets versions add database-url --data-file=-"
fi
if ! exists gcloud secrets describe django-secret-key; then
  python3 -c 'import secrets; print(secrets.token_urlsafe(50), end="")' |
    gcloud secrets create django-secret-key --replication-policy automatic --data-file=-
fi
# Only the running app can read them. GitHub never sees their values.
for secret in database-url django-secret-key; do
  gcloud secrets add-iam-policy-binding "$secret" --member "serviceAccount:$RUNTIME_SA" \
    --role roles/secretmanager.secretAccessor --quiet >/dev/null
done

say "Workload Identity Federation: GitHub logs in without key files, only from $REPO"
exists gcloud iam workload-identity-pools describe "$POOL" --location global ||
  gcloud iam workload-identity-pools create "$POOL" --location global --display-name "GitHub Actions"
exists gcloud iam workload-identity-pools providers describe "$PROVIDER" --location global --workload-identity-pool "$POOL" ||
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --location global --workload-identity-pool "$POOL" \
    --display-name "GitHub OIDC" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository == '${REPO}' && assertion.ref.startsWith('refs/tags/v')"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/${NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}" \
  --quiet >/dev/null

say "Done. Load these as GitHub variables (Settings > Secrets and variables > Actions > Variables)."
echo "None of them is secret."
cat <<OUT
GCP_PROJECT_ID     = ${PROJECT_ID}
GCP_PROJECT_NUMBER = ${NUMBER}
GCP_REGION         = ${REGION}
GCP_WIF_PROVIDER   = projects/${NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}
GCP_DEPLOY_SA      = ${DEPLOY_SA}
GCP_RUNTIME_SA     = ${RUNTIME_SA}

The app will answer at: https://cuadernos-${NUMBER}.${REGION}.run.app
OUT
