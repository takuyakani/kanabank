export type Role = 'parent' | 'child';

// 文字サイズ設定
export type FontSizePreference = 'small' | 'medium' | 'large';

// 表示モード（ふつう / ひらがなモード）
export type TextMode = 'normal' | 'hiragana';

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
  requestedReward?: number;   // 自由入力時に子どもが希望した金額（円）
}

// スケジュール設定種別
// daily: 毎日
// weekdays: 月〜金
// weekly_days: 曜日指定 (例: 月,水,金)
// monthly_date: 毎月X日 (例: 毎月1日, 15日)
// monthly_end: 毎月月末
// monthly_nth_weekday: 毎月第X曜日 (例: 第2月曜日)
export type ScheduleType =
  | 'daily'
  | 'weekdays'
  | 'weekly_days'
  | 'monthly_date'
  | 'monthly_end'
  | 'monthly_nth_weekday';

// 「いつもやること」マスター
export interface RoutineTask {
  id: string;
  title: string;
  reward: number;             // 0以上の金額（0の場合はご褒美なし）
  penaltyAmount: number;      // 期限超過時のペナルティ金額（円）
  graceDays: number;          // 猶予日数（0日=当日中、1日=翌日まで、など）
  scheduleType: ScheduleType;
  scheduleConfig?: {
    daysOfWeek?: number[];    // 0:日, 1:月, ..., 6:土
    dayOfMonth?: number;      // 1〜31
    nthWeek?: number;         // 1〜5 (第1〜第5)
    nthWeekday?: number;      // 0〜6 (曜日)
  };
  active: boolean;
  createdAt: string;
}

// 「いつもやること」日別インスタンスログ
export interface RoutineLog {
  id: string;                 // routineId_YYYY-MM-DD
  routineId: string;
  targetDate: string;         // YYYY-MM-DD
  title: string;
  reward: number;
  penaltyAmount: number;
  graceDays: number;
  dueDate: string;            // targetDate + graceDays の YYYY-MM-DD
  status: 'open' | 'pending' | 'completed' | 'penalized'; // 未報告・報告済・承認完了・ペナルティ
  reportedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  penalizedAt?: string;
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
  spendMethod?: 'cash' | 'virtual'; // 出金方法（現金手渡し / バーチャル残高のみ）
}
