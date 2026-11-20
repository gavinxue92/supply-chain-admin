import { request } from '../utils/request'
import type {
  ContactApiResult,
  CustomerServiceActiveRequest,
  CustomerServiceRequest,
  CustomerServiceVO,
  GlobalContactRequest,
  GlobalContactVO,
} from '../types/contact'

function requireData<T>(result: ContactApiResult<T>, fallback: string): T {
  if (!result.success) {
    throw new Error(result.message || fallback)
  }
  if (result.data === null) {
    throw new Error('服务器响应缺少客服数据')
  }
  return result.data
}

function requireSuccess(result: ContactApiResult<null>, fallback: string): void {
  if (!result.success) {
    throw new Error(result.message || fallback)
  }
}

export async function listCustomerServices(): Promise<CustomerServiceVO[]> {
  const response = await request.get<ContactApiResult<CustomerServiceVO[]>>(
    '/admin/customer-services',
  )
  return requireData(response.data, '获取客服联系人列表失败')
}

export async function createCustomerService(
  payload: CustomerServiceRequest,
): Promise<CustomerServiceVO> {
  const response = await request.post<ContactApiResult<CustomerServiceVO>>(
    '/admin/customer-services',
    payload,
  )
  return requireData(response.data, '创建客服联系人失败')
}

export async function updateCustomerService(
  id: number,
  payload: CustomerServiceRequest,
): Promise<CustomerServiceVO> {
  const response = await request.put<ContactApiResult<CustomerServiceVO>>(
    `/admin/customer-services/${id}`,
    payload,
  )
  return requireData(response.data, '保存客服联系人失败')
}

export async function setCustomerServiceActive(
  id: number,
  payload: CustomerServiceActiveRequest,
): Promise<void> {
  const response = await request.patch<ContactApiResult<null>>(
    `/admin/customer-services/${id}/active`,
    payload,
  )
  requireSuccess(response.data, '更新客服联系人状态失败')
}

export async function deleteCustomerService(id: number): Promise<void> {
  const response = await request.delete<ContactApiResult<null>>(`/admin/customer-services/${id}`)
  requireSuccess(response.data, '硬删除客服联系人失败')
}

export async function getGlobalContact(): Promise<GlobalContactVO | null> {
  const response = await request.get<ContactApiResult<GlobalContactVO>>(
    '/admin/contact/global',
  )
  if (!response.data.success) {
    throw new Error(response.data.message || '获取全局客服配置失败')
  }
  return response.data.data
}

export async function saveGlobalContact(
  payload: GlobalContactRequest,
): Promise<GlobalContactVO | null> {
  const response = await request.put<ContactApiResult<GlobalContactVO>>(
    '/admin/contact/global',
    payload,
  )
  if (!response.data.success) {
    throw new Error(response.data.message || '保存全局客服配置失败')
  }
  return response.data.data
}
