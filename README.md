# mo64 online memo

GitHub Pages + Supabase で動く、シンプルなオンラインメモの試作です。

## できること

- メールアドレスとパスワードでログイン / 新規登録
- メモの作成、編集、削除
- 入力後650msで自動保存
- メモ一覧とキーワード検索
- 同じアカウントなら別端末からもメモを利用可能

## セットアップ

### 1. Supabaseのテーブルを作成

1. Supabaseでプロジェクトを作成します。
2. Dashboardの **SQL Editor** を開きます。
3. このリポジトリの \`supabase/schema.sql\` の内容を貼り付けて実行します。
4. Authentication > Providers で Email が有効になっていることを確認します。

このSQLはRLSを有効にし、ログイン中のユーザーが自分のメモだけを操作できるようにします。

### 2. GitHub Pagesを有効化

Repository Settings > Pages で、Deploy from a branch / main / root を選択します。

### 3. アプリを開いて接続

1. 公開されたGitHub PagesのURLを開きます。
2. 右上の歯車からSupabase接続設定を開きます。
3. Supabase Dashboard > Project Settings > API Keys でProject URLとPublishable keyを確認して入力します。
4. メールアドレスとパスワードでアカウントを作成します。

メール確認が有効な場合は、確認メールのリンクを開いてからログインしてください。

## セキュリティ

- ブラウザに入力するのはPublishable key（旧anon key）のみです。
- \`service_role\` / secret keyは絶対にブラウザへ設定しないでください。
- メモテーブルにはRow Level Securityを設定し、\`auth.uid() = user_id\` で所有者を制限しています。
- 接続URLとPublishable keyは、そのブラウザのlocalStorageに保存されます。

## 注意

Supabaseプロジェクトの作成・接続、SQLの実行、GitHub Pagesの有効化は別途必要です。現時点では接続情報を含めていません。
