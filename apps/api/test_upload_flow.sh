#!/bin/bash
set -e

echo "=== 1. Register User ==="
REG_RESP=$(curl -s -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test_user_upload_4","email":"test_user_upload_4@synapse.chat","password":"password123"}')

TOKEN=$(echo $REG_RESP | jq -r .token)
echo "TOKEN=$TOKEN"

echo -e "\n=== 2. Create Guild & Channel ==="
GUILD_RESP=$(curl -s -X POST http://localhost:8080/api/v1/guilds \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Guild"}')
GUILD_ID=$(echo $GUILD_RESP | jq -r .id)

CH_RESP=$(curl -s -X POST http://localhost:8080/api/v1/guilds/$GUILD_ID/channels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"general","type":0}')
CHANNEL_ID=$(echo $CH_RESP | jq -r .id)
echo "CHANNEL_ID=$CHANNEL_ID"

echo -e "\n=== 3. Generate Upload URL ==="
UPL_RESP=$(curl -s -X POST http://localhost:8080/api/v1/channels/$CHANNEL_ID/attachments/upload-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category":"attachments","extension":".png","file_name":"test.png","size":123,"content_type":"image/png"}')
UPLOAD_ID=$(echo $UPL_RESP | jq -r .upload_id)
UPLOAD_URL=$(echo $UPL_RESP | jq -r .upload_url)
echo "UPLOAD_ID=$UPLOAD_ID"

echo -e "\n=== 4. Upload File to S3 ==="
curl -s -X PUT "$UPLOAD_URL" -d "fake file content"

echo -e "\n=== 5. Mark Upload Complete ==="
curl -s -X POST http://localhost:8080/api/v1/media/uploads/$UPLOAD_ID/complete \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n=== 6. Send Message ==="
MSG_RESP=$(curl -s -v -X POST http://localhost:8080/api/v1/channels/$CHANNEL_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"hello\",\"attachment_upload_ids\":[\"$UPLOAD_ID\"]}")

echo -e "\n=== Message Response ==="
echo "$MSG_RESP"
