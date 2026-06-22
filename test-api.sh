#!/bin/bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1X21xb3phaHNoaHc2a2xuIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzgyMTM5MTYwLCJleHAiOjE3ODI3NDM5NjB9.oD5Q92WNlRU5hPtCtxH7-mXUmzeUlKMJuELyaLEmzjM"
echo "Testing /api/auth/me with token..."
curl -s -w "\nHTTP_CODE:%{http_code}\n" http://localhost:7500/api/auth/me -H "Authorization: Bearer $TOKEN"
echo ""
echo "Testing /api/tier/me with token..."
curl -s -w "\nHTTP_CODE:%{http_code}\n" http://localhost:7500/api/tier/me -H "Authorization: Bearer $TOKEN"
echo ""
echo "DONE"
