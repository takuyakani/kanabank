import type { HouseholdData, ChoreMaster, ChoreRequest, Transaction, RoutineTask, RoutineLog } from '../types';

export const INITIAL_HOUSEHOLD: HouseholdData = {
  id: 'household-default',
  balance: 500,
  goalTitle: 'すきなおもちゃ・ゲーム',
  goalAmount: 3000,
  updatedAt: new Date().toISOString(),
};

export const INITIAL_CHORES: ChoreMaster[] = [
  { id: 'chore-1', title: 'お風呂そうじ', reward: 50, icon: 'bath', description: '浴槽や床をピカピカにする' },
  { id: 'chore-2', title: '食器洗い・お片付け', reward: 30, icon: 'dish', description: '食べた食器を洗って拭く' },
  { id: 'chore-3', title: 'ゴミ出し・ゴミまとめ', reward: 20, icon: 'trash', description: '家中のゴミ箱をまとめる' },
  { id: 'chore-4', title: '洗濯物をたたむ', reward: 30, icon: 'shirt', description: 'きれいにたたんで引き出しにしまう' },
  { id: 'chore-5', title: '部屋の掃除機・モップがけ', reward: 50, icon: 'sparkles', description: '床をきれいに掃除する' },
  { id: 'chore-6', title: '宿題をすべて終えた', reward: 20, icon: 'book', description: '毎日の宿題をしっかりやる' },
];

export const INITIAL_ROUTINES: RoutineTask[] = [
  {
    id: 'routine-1',
    title: '明日の学校の時間割と持ち物チェック',
    reward: 0, // ご褒美なし・ペナルティのみの例
    penaltyAmount: 30,
    graceDays: 0, // 当日中
    scheduleType: 'weekdays', // 月〜金
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'routine-2',
    title: '宿題をすべて終える',
    reward: 20,
    penaltyAmount: 50,
    graceDays: 1, // 翌日まで猶予
    scheduleType: 'daily', // 毎日
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'routine-3',
    title: '月初の部屋の持ち物・プリント整理',
    reward: 50,
    penaltyAmount: 50,
    graceDays: 2, // 2日猶予
    scheduleType: 'monthly_date', // 毎月1日
    scheduleConfig: { dayOfMonth: 1 },
    active: true,
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_ROUTINE_LOGS: RoutineLog[] = [];

export const INITIAL_REQUESTS: ChoreRequest[] = [
  {
    id: 'req-sample-1',
    choreId: 'chore-1',
    title: 'お風呂そうじ',
    reward: 50,
    bonus: 0,
    status: 'pending',
    requestedAt: new Date(Date.now() - 3600000).toISOString(),
    comment: 'ピカピカにみがいたよ！',
  },
];

const todayStr = new Date().toISOString().split('T')[0];
const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-sample-1',
    type: 'chore',
    title: '洗濯物をたたむ (承認)',
    amount: 30,
    date: yesterdayStr,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'お母さん',
    note: 'きれいにたためました！',
  },
  {
    id: 'tx-sample-2',
    type: 'chore',
    title: '宿題をすべて終えた (承認)',
    amount: 20,
    date: todayStr,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    createdBy: 'お父さん',
    note: 'がんばったね！',
  },
];
