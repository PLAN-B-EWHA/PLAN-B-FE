const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

async function parseApiResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    const message = body?.message || `Request failed: ${response.status}`
    const error = new Error(message)
    error.status = response.status
    error.body = body
    error.code = body?.errorCode || body?.code || null
    throw error
  }

  return body
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
  })

  return parseApiResponse(response)
}

function withBearer(accessToken, extraHeaders = {}) {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...extraHeaders,
  }
}

export async function registerRequest({ email, password, name }) {
  return request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })
}

export async function loginRequest({ email, password }) {
  return request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

export async function refreshRequest() {
  return request('/api/auth/refresh', { method: 'POST' })
}

export async function logoutRequest(accessToken) {
  return request('/api/auth/logout', {
    method: 'POST',
    headers: accessToken ? withBearer(accessToken) : {},
  })
}

export async function meRequest(accessToken) {
  return request('/api/users/me', {
    headers: withBearer(accessToken),
  })
}

export async function listUsersRequest(accessToken) {
  return request('/api/users', {
    headers: withBearer(accessToken),
  })
}

export async function promoteUserRoleRequest(accessToken, userId, role) {
  return request(`/api/users/${userId}/role`, {
    method: 'PATCH',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ role }),
  })
}

export async function myChildrenRequest(accessToken) {
  return request('/api/children/my', {
    headers: withBearer(accessToken),
  })
}

export async function createChildRequest(accessToken, payload) {
  return request('/api/children', {
    method: 'POST',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function deleteChildRequest(accessToken, childId) {
  return request('/api/children/' + childId, {
    method: 'DELETE',
    headers: withBearer(accessToken),
  })
}
export async function childAuthorizationsRequest(accessToken, childId) {
  return request(`/api/children/${childId}/authorizations`, {
    headers: withBearer(accessToken),
  })
}

export async function grantChildAuthorizationRequest(accessToken, childId, payload) {
  return request(`/api/children/${childId}/authorizations`, {
    method: 'POST',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function updateChildAuthorizationRequest(accessToken, childId, targetUserId, payload) {
  return request(`/api/children/${childId}/authorizations/${targetUserId}`, {
    method: 'PUT',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function revokeChildAuthorizationRequest(accessToken, childId, targetUserId) {
  return request(`/api/children/${childId}/authorizations/${targetUserId}`, {
    method: 'DELETE',
    headers: withBearer(accessToken),
  })
}

export async function accessibleChildrenRequest(accessToken) {
  return request('/api/children/accessible', {
    headers: withBearer(accessToken),
  })
}

export async function childDetailRequest(accessToken, childId) {
  return request(`/api/children/${childId}`, {
    headers: withBearer(accessToken),
  })
}

export async function updateChildRequest(accessToken, childId, payload) {
  return request(`/api/children/${childId}`, {
    method: 'PUT',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function uploadChildProfileImageRequest(accessToken, childId, file) {
  const formData = new FormData()
  formData.append('file', file)

  return request(`/api/children/${childId}/profile-image`, {
    method: 'POST',
    headers: withBearer(accessToken),
    body: formData,
  })
}

export async function deleteChildProfileImageRequest(accessToken, childId) {
  return request(`/api/children/${childId}/profile-image`, {
    method: 'DELETE',
    headers: withBearer(accessToken),
  })
}

export async function updateChildPinRequest(accessToken, childId, payload) {
  return request(`/api/children/${childId}/pin`, {
    method: 'PUT',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function removeChildPinRequest(accessToken, childId, currentPin) {
  const query = new URLSearchParams({ currentPin: String(currentPin) }).toString()
  return request(`/api/children/${childId}/pin?${query}`, {
    method: 'DELETE',
    headers: withBearer(accessToken),
  })
}

export async function issueTemporaryChildPinRequest(accessToken, childId) {
  return request(`/api/children/${childId}/pin/issue-temp`, {
    method: 'POST',
    headers: withBearer(accessToken),
  })
}

export async function childMissionsRequest(accessToken, childId, page = 0, size = 50) {
  return request(`/api/children/${childId}/missions?page=${page}&size=${size}`, {
    headers: withBearer(accessToken),
  })
}

export async function searchChildMissionsRequest(
  accessToken,
  childId,
  {
    status = null,
    therapistId = null,
    startDate = null,
    endDate = null,
    page = 0,
    size = 50,
    sortBy = 'assignedAt',
    sortDirection = 'DESC',
  } = {},
) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sortBy,
    sortDirection,
  })
  if (status) params.set('status', status)
  if (therapistId) params.set('therapistId', therapistId)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  return request(`/api/children/${childId}/missions/search?${params.toString()}`, {
    headers: withBearer(accessToken),
  })
}

export async function missionDetailRequest(accessToken, missionId) {
  return request(`/api/missions/${missionId}`, {
    headers: withBearer(accessToken),
  })
}

export async function missionTemplatesRequest(
  accessToken,
  { page = 0, size = 50, sortBy = 'createdAt', sortDirection = 'DESC' } = {},
) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sortBy,
    sortDirection,
  })
  return request(`/api/mission-templates?${params.toString()}`, {
    headers: withBearer(accessToken),
  })
}

export async function searchMissionTemplatesRequest(
  accessToken,
  {
    category = null,
    difficulty = null,
    keyword = null,
    llmGenerated = null,
    page = 0,
    size = 20,
    sortBy = 'createdAt',
    sortDirection = 'DESC',
  } = {},
) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sortBy,
    sortDirection,
  })
  if (category) params.set('category', category)
  if (difficulty) params.set('difficulty', difficulty)
  if (keyword) params.set('keyword', keyword)
  if (llmGenerated !== null && llmGenerated !== undefined) params.set('llmGenerated', String(llmGenerated))
  return request(`/api/mission-templates/search?${params.toString()}`, {
    headers: withBearer(accessToken),
  })
}

export async function getMissionTemplateRequest(accessToken, templateId) {
  return request(`/api/mission-templates/${templateId}`, {
    headers: withBearer(accessToken),
  })
}

export async function createMissionTemplateRequest(accessToken, payload) {
  return request('/api/mission-templates', {
    method: 'POST',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function updateMissionTemplateRequest(accessToken, templateId, payload) {
  return request(`/api/mission-templates/${templateId}`, {
    method: 'PUT',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function activateMissionTemplateRequest(accessToken, templateId) {
  return request(`/api/mission-templates/${templateId}/activate`, {
    method: 'PATCH',
    headers: withBearer(accessToken),
  })
}

export async function deactivateMissionTemplateRequest(accessToken, templateId) {
  return request(`/api/mission-templates/${templateId}/deactivate`, {
    method: 'PATCH',
    headers: withBearer(accessToken),
  })
}

export async function deleteMissionTemplateRequest(accessToken, templateId) {
  return request(`/api/mission-templates/${templateId}`, {
    method: 'DELETE',
    headers: withBearer(accessToken),
  })
}

export async function assignMissionRequest(accessToken, childId, templateId, dueDate) {
  return request(`/api/children/${childId}/missions`, {
    method: 'POST',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ childId, templateId, dueDate }),
  })
}

export async function updateMissionStatusRequest(accessToken, missionId, status, parentNote = '') {
  return request(`/api/missions/${missionId}/status`, {
    method: 'PATCH',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status, parentNote }),
  })
}

export async function uploadMissionPhotoRequest(accessToken, missionId, file) {
  const formData = new FormData()
  formData.append('file', file)

  return request(`/api/missions/${missionId}/photos`, {
    method: 'POST',
    headers: withBearer(accessToken),
    body: formData,
  })
}

export async function missionPhotosRequest(accessToken, missionId) {
  return request(`/api/missions/${missionId}/photos`, {
    headers: withBearer(accessToken),
  })
}

export async function verifyMissionRequest(accessToken, missionId, reviewDecision = 'APPROVE', therapistFeedback = '') {
  return request(`/api/missions/${missionId}/verify`, {
    method: 'PATCH',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ reviewDecision, therapistFeedback }),
  })
}

export async function therapistReviewQueueRequest(
  accessToken,
  { childId = null, page = 0, size = 20 } = {},
) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  })
  if (childId) params.set('childId', childId)
  return request(`/api/missions/review-queue?${params.toString()}`, {
    headers: withBearer(accessToken),
  })
}

export async function batchVerifyMissionsRequest(
  accessToken,
  { missionIds = [], reviewDecision = 'APPROVE', therapistFeedback = '' } = {},
) {
  return request('/api/missions/review-queue/batch-verify', {
    method: 'PATCH',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ missionIds, reviewDecision, therapistFeedback }),
  })
}

export async function healthRequest() {
  return request('/actuator/health')
}

export async function notificationsRequest(accessToken, page = 0, size = 20) {
  return request(`/api/notifications?page=${page}&size=${size}`, {
    headers: withBearer(accessToken),
  })
}

export async function markNotificationReadRequest(accessToken, notificationId) {
  return request(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: withBearer(accessToken),
  })
}

export async function markAllNotificationsReadRequest(accessToken, type = null) {
  const query = type ? `?type=${encodeURIComponent(type)}` : ''
  return request(`/api/notifications/read-all${query}`, {
    method: 'PATCH',
    headers: withBearer(accessToken),
  })
}

export async function cleanupNotificationsRequest(accessToken, beforeDays = 30, type = null) {
  const params = new URLSearchParams({ beforeDays: String(beforeDays) })
  if (type) params.set('type', type)
  return request(`/api/notifications/cleanup?${params.toString()}`, {
    method: 'DELETE',
    headers: withBearer(accessToken),
  })
}

export async function reportPreferenceRequest(accessToken) {
  return request('/api/reports/preferences/me', {
    headers: withBearer(accessToken),
  })
}

export async function updateReportPreferenceRequest(accessToken, payload) {
  return request('/api/reports/preferences/me', {
    method: 'PUT',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function generateTestReportRequest(accessToken, payload) {
  return request('/api/reports/test-generate', {
    method: 'POST',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function myReportsRequest(accessToken, page = 0, size = 20) {
  return request(`/api/reports/me?page=${page}&size=${size}`, {
    headers: withBearer(accessToken),
  })
}

export async function reportDetailRequest(accessToken, reportId) {
  return request(`/api/reports/${reportId}`, {
    headers: withBearer(accessToken),
  })
}

export async function reportExportBlobRequest(accessToken, reportId, format = 'pdf') {
  const response = await fetch(`${API_BASE_URL}/api/reports/${reportId}/export/${format}`, {
    method: 'GET',
    credentials: 'include',
    headers: withBearer(accessToken),
  })

  if (!response.ok) {
    const error = new Error(`Report export failed: ${response.status}`)
    error.status = response.status
    throw error
  }

  return response.blob()
}

export async function noteFeedRequest(accessToken, { page = 0, size = 20, type = null, keyword = null } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (type) params.set('type', type)
  if (keyword) params.set('keyword', keyword)
  return request(`/api/notes/feed?${params.toString()}`, {
    headers: withBearer(accessToken),
  })
}

export async function noteDetailRequest(accessToken, noteId) {
  return request(`/api/notes/${noteId}`, {
    headers: withBearer(accessToken),
  })
}

export async function noteCommentDetailRequest(accessToken, commentId) {
  return request(`/api/comments/${commentId}`, {
    headers: withBearer(accessToken),
  })
}

export async function createChildNoteRequest(accessToken, childId, payload) {
  return request(`/api/children/${childId}/notes`, {
    method: 'POST',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function updateChildNoteRequest(accessToken, noteId, payload) {
  return request(`/api/notes/${noteId}`, {
    method: 'PUT',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function deleteChildNoteRequest(accessToken, noteId) {
  return request(`/api/notes/${noteId}`, {
    method: 'DELETE',
    headers: withBearer(accessToken),
  })
}

export async function uploadNoteAssetRequest(accessToken, noteId, file) {
  const formData = new FormData()
  formData.append('file', file)

  return request(`/api/notes/${noteId}/assets`, {
    method: 'POST',
    headers: withBearer(accessToken),
    body: formData,
  })
}

export function uploadNoteAssetWithProgress(accessToken, noteId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}/api/notes/${noteId}/assets`)
    xhr.withCredentials = true
    if (accessToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || typeof onProgress !== 'function') return
      const percent = Math.round((event.loaded / event.total) * 100)
      onProgress(percent)
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText || '{}')
          resolve(body)
        } catch {
          resolve({ success: true, data: null })
        }
        return
      }

      let message = `Request failed: ${xhr.status}`
      try {
        const body = JSON.parse(xhr.responseText || '{}')
        message = body?.message || message
      } catch {
        // ignore
      }
      const error = new Error(message)
      error.status = xhr.status
      reject(error)
    }

    xhr.onerror = () => reject(new Error('Network error while uploading asset'))

    const formData = new FormData()
    formData.append('file', file)
    xhr.send(formData)
  })
}

export async function deleteNoteAssetRequest(accessToken, assetId) {
  return request(`/api/assets/${assetId}`, {
    method: 'DELETE',
    headers: withBearer(accessToken),
  })
}

export async function noteAssetBlobRequest(accessToken, assetId) {
  const response = await fetch(`${API_BASE_URL}/api/assets/${assetId}/download`, {
    method: 'GET',
    headers: withBearer(accessToken),
    credentials: 'include',
  })

  if (!response.ok) {
    const error = new Error(`Asset download failed: ${response.status}`)
    error.status = response.status
    throw error
  }

  return response.blob()
}

export async function noteCommentsRequest(accessToken, noteId) {
  return request(`/api/notes/${noteId}/comments`, {
    headers: withBearer(accessToken),
  })
}

export async function createNoteCommentRequest(accessToken, noteId, payload) {
  return request(`/api/notes/${noteId}/comments`, {
    method: 'POST',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function updateNoteCommentRequest(accessToken, commentId, payload) {
  return request(`/api/comments/${commentId}`, {
    method: 'PUT',
    headers: withBearer(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export async function deleteNoteCommentRequest(accessToken, commentId) {
  return request(`/api/comments/${commentId}`, {
    method: 'DELETE',
    headers: withBearer(accessToken),
  })
}
