import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CustomerProfileBody } from '@/app/_components/customer-profile/CustomerProfileBody'
import { fetchCustomerProfile } from '@/app/_components/customer-profile/data'

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const data = await fetchCustomerProfile(id)
  if (!data) notFound()

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          <span aria-hidden="true">←</span> Back to customers
        </Link>
      </div>
      <CustomerProfileBody data={data} />
    </div>
  )
}
