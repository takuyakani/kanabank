export type Role = 'parent' | 'child';

// 世帯・全体データ
export interface HouseholdData {
  id: string;
  balance: number;            // 現在のバーチャル残高（円）
  goalTitle: string;          // 目標名（例: スイッチのソフト）
  goalAmount: number;         // 目標金額（円）
  updatedAt: string;
}

// お手伝いマスター
export interface ChoreMaster {
  id: string;
  title: string;              // 例: お風呂そうじ
  reward: number;             // 例: 50
  icon: string;               // アイコン名
  description?: string;
}

// お手伝い申請
export interface ChoreRequest {
  id: string;
  choreId: string;
  title: string;
  reward: number;
  bonus: number;              // 承認時に親が上乗せしたボーナス
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;        // ISO 8601 文字列
  processedAt?: string;       // ISO 8601 文字列
  processedBy?: string;       // 承認・却下した親の識別子/メール
  comment?: string;           // 子どものコメント
  parentComment?: string;     // 親からのメッセージや却下理由
}

// 収支履歴（カレンダー表示用）
export type TransactionType = 'chore' | 'penalty' | 'spend';

export interface Transaction {
  id: string;
  type: TransactionType;
  title: string;              // 例: 「お風呂そうじ承認」「部屋を散らかした」「本を買った」
  amount: number;             // プラスまたはマイナスの金額
  date: string;               // YYYY-MM-DD (カレンダー検索用)
  createdAt: string;          // ISO 8601 文字列
  createdBy?: string;         // 操作した親の識別子/メール
  note?: string;
  relatedRequestId?: string;
}
