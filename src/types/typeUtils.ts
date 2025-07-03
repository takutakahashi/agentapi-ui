/**
 * 型安全性を向上させるためのユーティリティ型定義
 */

// ブランディッドタイプ（将来の拡張用）
// declare const __brand: unique symbol;
// type Brand<T, TBrand> = T & { [__brand]: TBrand };

// Profile関連の型エイリアス（段階的に型安全性を向上）
export type ProfileId = string;
export type ProfileName = string;
export type ProfileDescription = string;
export type SystemPrompt = string;
export type ISODateString = string;
export type LocalStorageKey = string;
export type JsonString = string;

// ユーティリティ型
export type NonEmptyString<T extends string = string> = T extends '' ? never : T;
export type ValidUrl = string;
export type PositiveNumber = number;

// Optional フィールドの型安全な処理
export type RequiredExcept<T, K extends keyof T> = Required<Omit<T, K>> & Pick<T, K>;
export type PartialExcept<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;

// Promise の型安全な処理
export type SafePromise<T, E = Error> = Promise<
  | { success: true; data: T }
  | { success: false; error: E }
>;

// localStorage 操作の結果型
export type StorageResult<T> = 
  | { success: true; data: T }
  | { success: false; error: StorageError };

// 配列の型安全性
export type NonEmptyArray<T> = [T, ...T[]];
export type ReadonlyNonEmptyArray<T> = readonly [T, ...readonly T[]];

// 条件型を使った型ガード
export type IsNullOrUndefined<T> = T extends null | undefined ? true : false;
export type IsString<T> = T extends string ? true : false;
export type IsArray<T> = T extends readonly unknown[] ? true : false;

// オブジェクトのキーの型安全性
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

// 型安全な JSON シリアライゼーション
export type JSONSerializable = 
  | string 
  | number 
  | boolean 
  | null 
  | JSONSerializable[] 
  | { [key: string]: JSONSerializable }
  | { readonly [key: string]: JSONSerializable };

// 型安全な部分更新
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends readonly (infer U)[]
    ? readonly DeepPartial<U>[]
    : T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

// エラーハンドリング用の型
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

// 型ガード関数の型
export type TypeGuard<T> = (value: unknown) => value is T;

// 設定値のバリデーション用型
export type ValidationResult<T> = 
  | { valid: true; value: T }
  | { valid: false; errors: string[] };

// 非同期操作の状態管理
export type AsyncState<T, E = Error> = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E };

// タイムスタンプの型安全性
export type Timestamp = number;
export type UnixTimestamp = number;

// ID生成の型安全性
export type UUID = string;
export type Base64String = string;

// 設定値の型安全性
export type ConfigValue<T> = {
  readonly value: T;
  readonly source: 'default' | 'profile' | 'explicit';
  readonly priority: number;
};

// 色コードの型安全性
export type HexColor = string;
export type RgbColor = string;

// アイコンの型安全性
export type EmojiIcon = string;
export type IconUrl = string;

// 組織・リポジトリの型安全性
export type OrganizationName = string;
export type RepositoryName = string;
export type FullRepositoryName = string; // "org/repo" format

// 型コンストラクタ関数（バリデーション付き）
export const createProfileId = (id: string): ProfileId => {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('Invalid ProfileId: must be a non-empty string');
  }
  return id;
};

export const createProfileName = (name: string): ProfileName => {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Invalid ProfileName: must be a non-empty string');
  }
  return name.trim();
};

export const createISODateString = (date: Date | string): ISODateString => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) {
    throw new Error('Invalid date for ISODateString');
  }
  return dateObj.toISOString();
};

export const createLocalStorageKey = (key: string): LocalStorageKey => {
  if (!key || typeof key !== 'string') {
    throw new Error('Invalid LocalStorageKey: must be a non-empty string');
  }
  return key;
};

export const createValidUrl = (url: string): ValidUrl => {
  try {
    new URL(url);
    return url;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
};

export const createUUID = (uuid: string): UUID => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    throw new Error(`Invalid UUID format: ${uuid}`);
  }
  return uuid;
};

export const createHexColor = (color: string): HexColor => {
  const hexRegex = /^#[0-9a-f]{6}$/i;
  if (!hexRegex.test(color)) {
    throw new Error(`Invalid hex color format: ${color}`);
  }
  return color;
};

// 型安全な JSON 操作
export const safeJsonParse = <T>(json: string): Result<T, SyntaxError> => {
  try {
    const parsed = JSON.parse(json);
    return { ok: true, value: parsed };
  } catch (error) {
    return { ok: false, error: error as SyntaxError };
  }
};

export const safeJsonStringify = <T extends JSONSerializable>(
  value: T
): Result<JsonString, TypeError> => {
  try {
    const stringified = JSON.stringify(value);
    return { ok: true, value: stringified as JsonString };
  } catch (error) {
    return { ok: false, error: error as TypeError };
  }
};

// 型ガード関数
export const isNonEmptyString = (value: unknown): value is NonEmptyString => {
  return typeof value === 'string' && value.length > 0;
};

export const isValidProfileId = (value: unknown): value is ProfileId => {
  return isNonEmptyString(value);
};

export const isValidProfileName = (value: unknown): value is ProfileName => {
  return isNonEmptyString(value) && value.trim().length > 0;
};

export const isISODateString = (value: unknown): value is ISODateString => {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !isNaN(date.getTime()) && date.toISOString() === value;
};

export const isValidUrl = (value: unknown): value is ValidUrl => {
  if (typeof value !== 'string') return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export const isUUID = (value: unknown): value is UUID => {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export const isHexColor = (value: unknown): value is HexColor => {
  if (typeof value !== 'string') return false;
  const hexRegex = /^#[0-9a-f]{6}$/i;
  return hexRegex.test(value);
};

export const isPositiveNumber = (value: unknown): value is PositiveNumber => {
  return typeof value === 'number' && value > 0 && !isNaN(value);
};

export const isNonEmptyArray = <T>(value: unknown): value is NonEmptyArray<T> => {
  return Array.isArray(value) && value.length > 0;
};

// 配列の型安全な操作
export const safeArrayAccess = <T>(
  array: readonly T[], 
  index: number
): T | undefined => {
  return index >= 0 && index < array.length ? array[index] : undefined;
};

export const safeArraySlice = <T>(
  array: readonly T[],
  start?: number,
  end?: number
): T[] => {
  try {
    return array.slice(start, end);
  } catch {
    return [];
  }
};

// オブジェクトの型安全な操作
export const safeObjectAccess = <T, K extends keyof T>(
  obj: T,
  key: K
): T[K] | undefined => {
  try {
    return obj && typeof obj === 'object' ? obj[key] : undefined;
  } catch {
    return undefined;
  }
};

// Promise の型安全な操作
export const createSafePromise = <T, E = Error>(
  promise: Promise<T>
): SafePromise<T, E> => {
  return promise
    .then((data): { success: true; data: T } => ({ success: true, data }))
    .catch((error): { success: false; error: E } => ({ success: false, error }));
};

// LocalStorage エラー型
import type { StorageError } from './errors';