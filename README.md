# カナバンク (KanaBank) - 子ども用バーチャルおこづかい管理システム

親子で使えるWebベースのバーチャルお小遣い管理アプリです。
お手伝いの申請・承認、叱られた時の減額ペナルティ、お小遣い使用記録、目標金額までの進捗ゲージ、カレンダーによる月別サマリー＆履歴管理、および複数端末でのクラウドリアルタイム同期機能を備えています。

---

## 💡 特徴・改善ポイント
- **親子・保護者2名体制に対応（操作者の自動記録）**:
  - お父さん・お母さんの個別ログインに対応。
  - お手伝いの承認や減額を行った際、カレンダー履歴に「どの親が操作したか」を自動表示。
- **親子ともにモバイル最適化（固定ボトムナビゲーション）**:
  - 親画面・子画面ともに画面下部の固定ボトムナビゲーションバーを搭載。スマートフォンの画面幅（375px〜390px）でも見切れず片手で快適に操作可能。
- **独立したURLアクセス & 認可ガード**:
  - 子ども用画面: `/#/child`
  - 保護者用画面: `/#/parent`
  - 子どもアカウントで保護者URL（`#/parent`）にアクセスしても侵入できず、保護者パスワードでの再認証を強制（認可バイパス防止）。
- **財務整合性・リアルタイムバリデーションガード**:
  - 出金時：現在の残高を超える出金をブロックし「残高不足」を明示。
  - 減額時：1円未満や負数の入力をリアルタイムで検知し、ボタンを非活性化。
- **目標達成とお祝い体験**:
  - 目標金額に達した際の祝福バナーと「目標の品を購入する（出金＆リセット）」連携。親画面からもワンタップで引き換え可能。
- **Firebase環境変数埋め込みによる完全自動クラウド同期**:
  - ビルド時に環境変数を埋め込むことで、家族の端末では設定入力不要で最初からクラウド同期状態で利用可能。

---

## 🚀 使い方・URL構成

本アプリは GitHub Pages 等の静的ホスティングで動作するよう、HashRouter（`/#/...`）を採用しています。

1. **総合トップページ**: `http://localhost:5173/` (またはデプロイ先URL)
2. **子ども用ポータル**: `http://localhost:5173/#/child`
3. **保護者用ポータル**: `http://localhost:5173/#/parent`

---

## 🔥 GitHub Pages 公開とFirebase自動同期の設定手順

ご家族全員が設定不要でクラウド同期を利用するための設定手順です：

### 1. Firebaseプロジェクトの準備（無料）
1. [Firebase Console](https://console.firebase.google.com/) で新規プロジェクトを作成します。
2. **Authentication** で「メール/パスワード」認証を有効化します。
3. **Cloud Firestore** を作成し、ルールに以下を設定して安全に保護します：
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       allow read, write: if request.auth != null;
     }
   }
   ```
4. プロジェクト設定から Webアプリの `apiKey` と `projectId` を取得します。

### 2. GitHub Secrets の登録
GitHub リポジトリの `Settings > Secrets and variables > Actions` に以下を登録します：
* `VITE_FIREBASE_API_KEY`: 取得したAPIキー
* `VITE_FIREBASE_PROJECT_ID`: 取得したプロジェクトID
* `VITE_FIREBASE_AUTH_DOMAIN`: `your-project-id.firebaseapp.com`

プッシュすると、GitHub Actions が自動でビルドし、最初からクラウド同期が有効化された状態で GitHub Pages に公開されます。
