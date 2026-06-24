#!/bin/bash
set -e

echo "=== 1. Register User ==="
REG_RESP=$(curl -s -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"spaceman","email":"spaceman@synapse.chat","password":"password123"}')
echo "Register Response: $REG_RESP"

TOKEN=$(echo $REG_RESP | grep -o '"token":"[^"]*' | grep -o '[^"]*$')
if [ -z "$TOKEN" ]; then
  echo "Error: Failed to parse JWT token from registration"
  exit 1
fi
echo "Parsed Token: $TOKEN"

echo -e "\n=== 2. Fetch User Profile (@me) ==="
ME_RESP=$(curl -s -X GET http://localhost:8080/api/v1/users/@me \
  -H "Authorization: Bearer $TOKEN")
echo "Me Response: $ME_RESP"

echo -e "\n=== 3. Create Guild ==="
GUILD_RESP=$(curl -s -X POST http://localhost:8080/api/v1/guilds \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Synapse Developers","description":"A server for Synapse core developers"}')
echo "Guild Response: $GUILD_RESP"

GUILD_ID=$(echo $GUILD_RESP | grep -o '"id":"[^"]*' | grep -o '[^"]*$')
if [ -z "$GUILD_ID" ]; then
  echo "Error: Failed to parse Guild ID"
  exit 1
fi
echo "Parsed Guild ID: $GUILD_ID"

echo -e "\n=== 4. Fetch Guild Details ==="
curl -s -X GET http://localhost:8080/api/v1/guilds/$GUILD_ID \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n=== 5. Create Channel ==="
CHAN_RESP=$(curl -s -X POST http://localhost:8080/api/v1/guilds/$GUILD_ID/channels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"general","type":0,"topic":"General text discussion"}')
echo "Channel Response: $CHAN_RESP"

CHAN_ID=$(echo $CHAN_RESP | grep -o '"id":"[^"]*' | grep -o '[^"]*$')
if [ -z "$CHAN_ID" ]; then
  echo "Error: Failed to parse Channel ID"
  exit 1
fi
echo "Parsed Channel ID: $CHAN_ID"

echo -e "\n=== 6. Send Message (DB + Outbox write) ==="
MSG_RESP=$(curl -s -X POST http://localhost:8080/api/v1/channels/$CHAN_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello, Synapse backend works!"}')
echo "Message Response: $MSG_RESP"

MSG_ID=$(echo $MSG_RESP | grep -o '"id":"[^"]*' | grep -o '[^"]*$')
if [ -z "$MSG_ID" ]; then
  echo "Error: Failed to parse Message ID"
  exit 1
fi
echo "Parsed Message ID: $MSG_ID"

echo -e "\n=== 7. Fetch Messages (Cursor-based) ==="
curl -s -X GET "http://localhost:8080/api/v1/channels/$CHAN_ID/messages?limit=10" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n=== 8. Sync Read State (Redis-first write) ==="
curl -i -s -X POST http://localhost:8080/api/v1/channels/$CHAN_ID/read \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"last_read_message_id\":\"$MSG_ID\"}"

echo -e "\n\n=== 9. Create Invite ==="
INV_RESP=$(curl -s -X POST http://localhost:8080/api/v1/guilds/$GUILD_ID/invites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"max_uses":10,"duration":86400}')
echo "Invite Response: $INV_RESP"

INV_CODE=$(echo $INV_RESP | grep -o '"code":"[^"]*' | grep -o '[^"]*$')
if [ -z "$INV_CODE" ]; then
  echo "Error: Failed to parse Invite Code"
  exit 1
fi
echo "Parsed Invite Code: $INV_CODE"

echo -e "\n=== 10. Fetch Invite Metadata ==="
curl -s -X GET http://localhost:8080/api/v1/invites/$INV_CODE \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n=== All Tests Passed Successfully ==="
