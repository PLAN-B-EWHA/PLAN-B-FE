import { resolveApiUrl } from './api'

export const defaultChildForm = {
  name: '',
  birthDate: '',
  gender: 'MALE',
  diagnosisDate: '',
  diagnosisInfo: '',
  specialNotes: '',
  interests: '',
  pin: '',
  profileImageUrl: '',
  languageSkill: '',
  sensoryProcessing: '',
  preferredExpressions: [],
  difficultExpressions: [],
}

export const languageSkillOptions = [
  { value: 'NONVERBAL', label: '비언어 표현 중심' },
  { value: 'VOCABULARY', label: '단어 표현 가능' },
  { value: 'SHORT_SENTENCE', label: '짧은 문장 가능' },
  { value: 'FLUENT', label: '유창한 표현 가능' },
]

export const sensoryProcessingOptions = [
  { value: 'AUDITORY_SENSITIVITY', label: '청각 민감성' },
  { value: 'SENSORY_SEEKING', label: '감각 추구 성향' },
  { value: 'TACTILE_DEFENSIVENESS', label: '촉각 방어 성향' },
]

export const expressionTagOptions = [
  { value: 'JOY', label: '기쁨' },
  { value: 'SAD', label: '슬픔' },
  { value: 'FEAR', label: '두려움' },
  { value: 'SURPRISE', label: '놀람' },
  { value: 'DISGUST', label: '싫음' },
  { value: 'ANGRY', label: '분노' },
]

export function calculateAgeLabel(birthDate, fallback = '생년월일 미입력') {
  if (!birthDate) {
    return fallback
  }

  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDelta = today.getMonth() - birth.getMonth()

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }

  return `만 ${Math.max(age, 0)}세`
}

export function getGenderLabel(gender) {
  if (gender === 'MALE') {
    return '남아'
  }

  if (gender === 'FEMALE') {
    return '여아'
  }

  return '기타'
}

export function normalizeChildForm(form) {
  return {
    name: form.name,
    birthDate: form.birthDate || null,
    gender: form.gender || null,
    diagnosisDate: form.diagnosisDate || null,
    diagnosisInfo: form.diagnosisInfo || null,
    specialNotes: form.specialNotes || null,
    interests: form.interests || null,
    pin: form.pin || null,
    profileImageUrl: form.profileImageUrl || null,
    languageSkill: form.languageSkill || null,
    sensoryProcessing: form.sensoryProcessing || null,
    preferredExpressions: form.preferredExpressions?.length ? form.preferredExpressions : [],
    difficultExpressions: form.difficultExpressions?.length ? form.difficultExpressions : [],
  }
}

export function getLanguageSkillLabel(value) {
  return languageSkillOptions.find((option) => option.value === value)?.label || '미입력'
}

export function getSensoryProcessingLabel(value) {
  return sensoryProcessingOptions.find((option) => option.value === value)?.label || '미입력'
}

export function getExpressionTagLabel(value) {
  return expressionTagOptions.find((option) => option.value === value)?.label || value
}

export function buildChildFormFromDetail(detail) {
  if (!detail) {
    return { ...defaultChildForm }
  }

  return {
    name: detail.name || '',
    birthDate: detail.birthDate || '',
    gender: detail.gender || 'MALE',
    diagnosisDate: detail.diagnosisDate || '',
    diagnosisInfo: detail.diagnosisInfo || '',
    specialNotes: detail.specialNotes || '',
    interests: detail.interests || '',
    pin: '',
    profileImageUrl: detail.profileImageUrl || '',
    languageSkill: detail.languageSkill || '',
    sensoryProcessing: detail.sensoryProcessing || '',
    preferredExpressions: Array.isArray(detail.preferredExpressions) ? detail.preferredExpressions : [],
    difficultExpressions: Array.isArray(detail.difficultExpressions) ? detail.difficultExpressions : [],
  }
}

export function resolveUploadUrl(url) {
  if (!url) {
    return ''
  }

  if (/^https?:\/\//.test(url)) {
    return url
  }

  return resolveApiUrl(url, { skipApiPrefix: true })
}
