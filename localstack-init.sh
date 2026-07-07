#!/usr/bin/env bash
set -euo pipefail

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_REGION=us-east-1

echo "[localstack-init] starting S3 bootstrap"

if command -v awslocal >/dev/null 2>&1; then
  AWS_CMD=(awslocal)
elif command -v localstack >/dev/null 2>&1; then
  AWS_CMD=(localstack aws)
elif command -v aws >/dev/null 2>&1; then
  AWS_CMD=(aws --endpoint-url=http://localhost:4566)
else
  echo "[localstack-init] ERROR: no AWS CLI found (awslocal/localstack/aws)" >&2
  exit 1
fi

CORS='{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET","PUT","POST","DELETE","HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}'

"${AWS_CMD[@]}" s3api create-bucket \
  --bucket synapse-bucket \
  --region us-east-1 >/dev/null 2>&1 || true

"${AWS_CMD[@]}" s3api put-bucket-cors \
  --bucket synapse-bucket \
  --cors-configuration "$CORS"

POLICY='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": [
        "arn:aws:s3:::synapse-bucket/avatars/*",
        "arn:aws:s3:::synapse-bucket/banners/*",
        "arn:aws:s3:::synapse-bucket/guild-icons/*"
      ]
    }
  ]
}'

"${AWS_CMD[@]}" s3api put-bucket-policy \
  --bucket synapse-bucket \
  --policy "$POLICY"

echo "[localstack-init] completed S3 bootstrap"