#!/bin/bash

# ネットワーク診断スクリプト

echo "=== ネットワーク診断 ==="
echo ""

echo "1. DNS解決の確認:"
echo "   nslookup db.wzktmwufngrdbuxnorqd.supabase.co"
echo "   dig db.wzktmwufngrdbuxnorqd.supabase.co"
echo ""

echo "2. IPv4/IPv6の確認:"
echo "   ip -4 addr show"
echo "   ip -6 addr show"
echo ""

echo "3. ルーティングテーブルの確認:"
echo "   ip route show"
echo ""

echo "4. 外部への接続テスト:"
echo "   curl -4 -I https://www.google.com"
echo "   curl -6 -I https://www.google.com"
echo ""

echo "5. Supabaseへの接続テスト（IPv4/IPv6別）:"
echo "   curl -4 -I https://db.wzktmwufngrdbuxnorqd.supabase.co"
echo "   curl -6 -I https://db.wzktmwufngrdbuxnorqd.supabase.co"
echo ""

echo "6. セッションプーラーへの接続テスト:"
echo "   ping -c 3 aws-1-ap-northeast-1.pooler.supabase.com"
echo "   curl -4 -I https://aws-1-ap-northeast-1.pooler.supabase.com"
echo ""

echo "=== 推奨される対応 ==="
echo ""
echo "pingが失敗する場合、以下の可能性があります:"
echo "1. サーバーがIPv4のみで、Supabaseの直接接続がIPv6のみ"
echo "2. ファイアウォールでICMPがブロックされている"
echo "3. DNS解決ができない"
echo ""
echo "解決方法:"
echo "- Session Poolerを使用（IPv4対応）"
echo "- SupabaseのIPアドレス許可リストを確認"
echo "- サーバーのネットワーク設定を確認"
echo ""

