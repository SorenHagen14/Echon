'use server'

import { fetchCustomerProfile, type CustomerProfileData } from './data'

export async function loadCustomerProfile(customerId: string): Promise<CustomerProfileData | null> {
  if (!customerId) return null
  return fetchCustomerProfile(customerId)
}
