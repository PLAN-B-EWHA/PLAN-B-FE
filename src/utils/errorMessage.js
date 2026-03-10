const ERROR_CODE_MESSAGES = {
  AUTH_FAILED: '로그인 정보가 올바르지 않습니다.',
  MISSING_TOKEN: '인증 토큰이 필요합니다. 다시 로그인하세요.',
  EXPIRED_TOKEN: '세션이 만료되었습니다. 다시 로그인하세요.',
  INVALID_TOKEN: '유효하지 않은 토큰입니다. 다시 로그인하세요.',
  ACCESS_DENIED: '요청 권한이 없습니다.',
  PENDING_ACCOUNT: '권한 승인 대기 중인 계정입니다.',
  INVALID_ARGUMENT: '입력값을 확인해주세요.',
  VALIDATION_FAILED: '요청 값 검증에 실패했습니다.',
  LLM_QUOTA_EXCEEDED: 'AI 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.',
  INVALID_STATE: '현재 상태에서 수행할 수 없는 요청입니다.',
  INTERNAL_ERROR: '서버 내부 오류가 발생했습니다.',
  RUNTIME_ERROR: '요청 처리 중 오류가 발생했습니다.',
}

export function resolveErrorMessage(error, fallbackMessage = '요청 처리 중 오류가 발생했습니다.') {
  if (!error) return fallbackMessage

  const code = error?.body?.errorCode || error?.body?.code
  if (code && ERROR_CODE_MESSAGES[code]) {
    return ERROR_CODE_MESSAGES[code]
  }

  return error.message || fallbackMessage
}
