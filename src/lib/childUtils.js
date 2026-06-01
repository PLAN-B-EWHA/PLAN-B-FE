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
}

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
  }
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

export function hasChildPermission(child, permission) {
  const permissions = child?.myPermissions || []
  return child?.isPrimaryParent || permissions.includes(permission)
}

export function canPlayGame(child) {
  return hasChildPermission(child, 'PLAY_GAME')
}

export function canViewReport(child) {
  return hasChildPermission(child, 'VIEW_REPORT')
}

export function canWriteNote(child) {
  return hasChildPermission(child, 'WRITE_NOTE')
}

export function canAssignMission(child) {
  return hasChildPermission(child, 'ASSIGN_MISSION') || hasChildPermission(child, 'MANAGE')
}

export function canManageStudent(child) {
  return hasChildPermission(child, 'MANAGE')
}
