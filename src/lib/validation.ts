export const NICKNAME_MAX = 20;
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 128;

/** Returns an error message, or null when valid. */
export function validateNickname(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return '닉네임을 입력해주세요.';
  const v = value.trim();
  if (v.length > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MAX}자 이하로 입력해주세요.`;
  if (v.includes('#')) return '닉네임에는 #을 쓸 수 없습니다.';
  return null;
}

export function validatePassword(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return '비밀번호를 입력해주세요.';
  if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) {
    return `비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자로 입력해주세요.`;
  }
  return null;
}
