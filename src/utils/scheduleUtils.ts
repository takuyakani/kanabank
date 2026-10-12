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

// 日付文字列 (YYYY-MM-DD) の差分日数 (dateB - dateA)
export function getDaysDiff(dateAStr: string, dateBStr: string): number {
  const a = new Date(dateAStr).getTime();
  const b = new Date(dateBStr).getTime();
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
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
