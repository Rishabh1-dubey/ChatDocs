import Link from 'next/link'
import MaxWidthWrapper from './MaxWidthWrapper'
import { buttonVariants } from './ui/button'
import {
  LoginLink,
  RegisterLink,
  getKindeServerSession,
} from '@kinde-oss/kinde-auth-nextjs/server'
import { ArrowRight } from 'lucide-react'

// import MobileNav from './MobileNav'
import UserAccountNav from './UserAccountNav'
import MobileNav from './MobileNav'

const Navbar =async () => {
  const { getUser } = getKindeServerSession()
  const user = await getUser()

  return (
    <nav className='sticky h-14 inset-x-0 top-0 z-30 w-full border-b border-gray-200 bg-white/75 backdrop-blur-lg transition-all'>
      <MaxWidthWrapper>
        <div className='flex h-14 items-center justify-between border-b border-zinc-200'>
          <Link
            href='/'
            className='flex z-40 font-semibold'>
            <span>ChatDocs</span>
          </Link>

          <MobileNav isAuth={!!user} />

          <div className='hidden items-center space-x-4 sm:flex'>
            {!user ? (
              <>
                <Link
                  href='/pricing'
                  className='font-medium hover:bg-zinc-100 px-2 py-1 rounded-lg'>
                  Pricing
                </Link>
                <LoginLink
                  className='font-medium hover:bg-zinc-100 px-2 py-1 rounded-lg'>
                  Sign in
                </LoginLink>
                <RegisterLink
                   className='font-medium flex bg-blue-700  text-white hover:bg-blue-500 px-3 py-2 rounded-lg'>
                  Get started{' '}
                  <ArrowRight className='ml-1.5 h-5 w-5' />
                </RegisterLink>
              </>
            ) : (
              <>
                <Link
                  href='/dashboard'
                  className="font-medium hover:bg-zinc-100 px-2 py-1 rounded-lg">
                  Dashboard
                </Link>

                <UserAccountNav
                  name={
                    !(await user).given_name || !(await user).family_name
                      ? 'Your Account'
                      : `${(await user).given_name} ${(await user).family_name}`
                  }
                  email={(await user).email ?? ''}
                  imageUrl={(await user).picture ?? ''}
                />
              </>
            )}
          </div>
        </div>
      </MaxWidthWrapper>
    </nav>
  )
}

export default Navbar