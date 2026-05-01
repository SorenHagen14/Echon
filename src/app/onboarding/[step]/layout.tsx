import { notFound } from 'next/navigation'
import { OnboardingProgressBar } from '../_components/OnboardingProgressBar'
import { isValidStep } from '../_constants'

type Props = {
  children: React.ReactNode
  params: Promise<{ step: string }>
}

export default async function StepLayout({ children, params }: Props) {
  const { step } = await params
  const n = Number(step)
  if (!isValidStep(n)) notFound()

  return (
    <div>
      <OnboardingProgressBar currentStep={n} />
      <div className="mt-8">{children}</div>
    </div>
  )
}
