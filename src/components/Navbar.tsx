import Link from "next/link";
import MaxWidthWrapper from "./MaxWidthWrapper";
import { buttonVariants } from "./ui/button";
import {
  LoginLink,
  RegisterLink,
  getKindeServerSession,
} from "@kinde-oss/kinde-auth-nextjs/server";
import { ArrowRight } from "lucide-react";

const Navbar = () => {
  const { getUser } = getKindeServerSession();
  const user = getUser();

  return (
    <nav className="sticky h-14 inset-x-0 top-0 z-30 w-full border-b border-gray-200 bg-white/75 backdrop-blur-lg transition-all">
      <MaxWidthWrapper>
        <div className="flex h-14 items-center justify-between border-b border-zinc-200">
          <Link href="/" className="flex z-40 font-semibold">
            <span>ChatDocs.</span>
          </Link>

          {/* <MobileNav isAuth={!!user} /> */}

          <div className="hidden items-center space-x-4 sm:flex ">
            <>
              <Link
                href={"/pricing"}
                className="font-medium hover:bg-zinc-100 px-2 py-1 rounded-lg"
              >
                Pricing
              </Link>
              <LoginLink className="font-medium hover:bg-zinc-100 px-2 py-1 rounded-lg">
                Sign In
              </LoginLink>
              <RegisterLink className="font-medium flex items-center bg-blue-700  text-white hover:bg-blue-500 px-4 py-1 rounded-lg">
                Get started <ArrowRight className="mt-[5px] ml-2" />
              </RegisterLink>
            </>

            <>
            

              {/* <UserAccountNav
                  name={
                    !user.given_name || !user.family_name
                      ? 'Your Account'
                      : `${user.given_name} ${user.family_name}`
                  }
                  email={user.email ?? ''}
                  imageUrl={user.picture ?? ''}
                /> */}
            </>
          </div>
        </div>
      </MaxWidthWrapper>
    </nav>
  );
};

export default Navbar;
