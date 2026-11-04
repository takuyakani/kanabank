import type { RoutineTask } from '../types';

// 指定した日付 (Date) がタスクのスケジュールに合致するか判定する
export function isTaskScheduledForDate(task: RoutineTask, date: Date): boolean {
  if (!task.active) return false;

  const dayOfWeek = date.getDay(); // 0:日, 1:月, ..., 6:土
  const dayOfMonth = date.getDate(); // 1〜31

  switch (task.scheduleType) {
    case 'daily':
      return true;

    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;

    case 'weekly_days':
      return Boolean(task.scheduleConfig?.daysOfWeek?.includes(dayOfWeek));

    case 'monthly_date':
      return task.scheduleConfig?.dayOfMonth === dayOfMonth;

    case 'monthly_end': {
      // 翌日の日付が1日なら、当日は月末
      const tomorrow = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      return tomorrow.getDate() === 1;
    }

    case 'monthly_nth_weekday': {
      const targetNth = task.scheduleConfig?.nthWeek || 1;
      const targetWeekday = task.scheduleConfig?.nthWeekday ?? 1;

      if (dayOfWeek !== targetWeekday) return false;

      // 当月内で何回目の該当曜日かを計算
      const currentNth = Math.floor((dayOfMonth - 1) / 7) + 1;
      return currentNth === targetNth;
    }

    default:
      return false;
  }
}

// targetDate (YYYY-MM-DD) に graceDays を足した期日 (YYYY-MM-DD) を計算
export function calculateDueDate(targetDateStr: string, graceDays: number): string {
  const parts = targetDateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + graceDays);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ローカル日時基準の YYYY-MM-DD 文字列を取得する
export function getLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 日付文字列 (YYYY-MM-DD) の差分日数 (dateB - dateA)
export function getDaysDiff(dateAStr: string, dateBStr: string): number {
  const partsA = dateAStr.split('-').map(Number);
  const partsB = dateBStr.split('-').map(Number);
  const a = new Date(partsA[0], partsA[1] - 1, partsA[2]).getTime();
  const b = new Date(partsB[0], partsB[1] - 1, partsB[2]).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// 目標達成に必要な1日あたりの積み上げペース計算結果
export interface GoalPaceResult {
  hasTargetDate: boolean;
  targetDate?: string;
  diffDays: number;
  remainingAmount: number;
  dailyPace: number;
  status: 'reached' | 'active' | 'today' | 'overdue' | 'none';
}

// 目標までの残り日数と1日あたりの必要積み上げペースを算出
export function calculateGoalPace(
  balance: number,
  goalAmount: number,
  targetDateStr?: string,
  todayStr: string = getLocalDateStr()
): GoalPaceResult {
  const remainingAmount = Math.max(0, goalAmount - balance);

  if (remainingAmount <= 0) {
    return {
      hasTargetDate: Boolean(targetDateStr),
      targetDate: targetDateStr,
      diffDays: 0,
      remainingAmount: 0,
      dailyPace: 0,
      status: 'reached',
    };
  }

  if (!targetDateStr) {
    return {
      hasTargetDate: false,
      diffDays: 0,
      remainingAmount,
      dailyPace: 0,
      status: 'none',
    };
  }

  const diffDays = getDaysDiff(todayStr, targetDateStr);

  if (diffDays > 0) {
    // 目標日が未来（残り diffDays 日）
    const dailyPace = Math.ceil(remainingAmount / diffDays);
    return {
      hasTargetDate: true,
      targetDate: targetDateStr,
      diffDays,
      remainingAmount,
      dailyPace,
      status: 'active',
    };
  } else if (diffDays === 0) {
    // 目標日が当日
    return {
      hasTargetDate: true,
      targetDate: targetDateStr,
      diffDays: 0,
      remainingAmount,
      dailyPace: remainingAmount,
      status: 'today',
    };
  } else {
    // 目標日を超過
    return {
      hasTargetDate: true,
      targetDate: targetDateStr,
      diffDays,
      remainingAmount,
      dailyPace: 0,
      status: 'overdue',
    };
  }
}

// スケジュール設定の説明文を生成する
export function formatScheduleDescription(task: RoutineTask): string {
  const weekdaysName = ['日', '月', '火', '水', '木', '金', '土'];

  switch (task.scheduleType) {
    case 'daily':
      return 'まいにち';
    case 'weekdays':
      return '月〜金（平日）';
    case 'weekly_days': {
      const days = (task.scheduleConfig?.daysOfWeek || [])
        .map((d) => weekdaysName[d])
        .join('・');
      return `毎週 ${days}曜日`;
    }
    case 'monthly_date':
      return `毎月 ${task.scheduleConfig?.dayOfMonth || 1}日`;
    case 'monthly_end':
      return '毎月 月末';
    case 'monthly_nth_weekday': {
      const nth = task.scheduleConfig?.nthWeek || 1;
      const wName = weekdaysName[task.scheduleConfig?.nthWeekday ?? 1];
      return `毎月 第${nth}${wName}曜日`;
    }
    default:
      return 'スケジュール';
  }
}
