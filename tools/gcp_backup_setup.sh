#!/usr/bin/env bash
# Prepares the backup bucket in Google Cloud (docs/operacion/backups.md).
# Run it yourself in Cloud Shell, once, after tools/gcp_bootstrap.sh. Running it again is safe.
#
#   bash tools/gcp_backup_setup.sh PROJECT_ID [REGION] [GITHUB_REPO]
#
# What it does:
#   - Creates a private bucket that deletes backups older than 30 days.
#   - Lets the deploy service account create files in that bucket, and nothing else there
#     (it cannot read, overwrite or delete backups).
#   - Lets GitHub log in from main, but only for the backup workflow. Every other workflow
#     still needs a v* tag, as before.
set -euo pipefail

PROJECT_ID="${1:?Usage: bash tools/gcp_backup_setup.sh PROJECT_ID [REGION] [GITHUB_REPO]}"
REGION="${2:-southamerica-east1}"
REPO="${3:-aleharo2003/floky-cuadernos}"
BUCKET="${PROJECT_ID}-backups"
POOL=github
PROVIDER=github-oidc
DEPLOY_SA="cuadernos-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
CONDITION="assertion.repository == '${REPO}' && (assertion.ref.startsWith('refs/tags/v') || (assertion.ref == 'refs/heads/main' && assertion.workflow_ref == '${REPO}/.github/workflows/backup.yml@refs/heads/main'))"

say() { printf '\n== %s\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }

gcloud config set project "$PROJECT_ID" >/dev/null

say "Turning on the Cloud Storage API"
gcloud services enable storage.googleapis.com

say "Private bucket gs://${BUCKET} in ${REGION}"
exists gcloud storage buckets describe "gs://${BUCKET}" ||
  gcloud storage buckets create "gs://${BUCKET}" --location "$REGION" \
    --default-storage-class STANDARD --uniform-bucket-level-access --public-access-prevention

say "Delete backups older than 30 days"
lifecycle=$(mktemp)
cat > "$lifecycle" <<'JSON'
{"rule": [{"action": {"type": "Delete"}, "condition": {"age": 30, "matchesPrefix": ["daily/"]}}]}
JSON
gcloud storage buckets update "gs://${BUCKET}" --lifecycle-file "$lifecycle" >/dev/null
rm -f "$lifecycle"

say "The deploy service account can only create files in this bucket"
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member "serviceAccount:${DEPLOY_SA}" --role roles/storage.objectCreator >/dev/null

say "GitHub can log in from main, only for the backup workflow"
gcloud iam workload-identity-pools providers update-oidc "$PROVIDER" --location global \
  --workload-identity-pool "$POOL" --attribute-condition "$CONDITION" >/dev/null

say "Done. Load this as a GitHub variable (Settings > Secrets and variables > Actions > Variables)."
echo "It is not secret."
echo "GCS_BACKUP_BUCKET = ${BUCKET}"
