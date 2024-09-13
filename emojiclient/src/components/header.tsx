import { Menu, X } from "lucide-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="bg-gradient-to-r from-blue-400 via-teal-500 to-green-500 text-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <a href="/" className="flex items-center space-x-2">
            <span className="font-bold text-2xl">😂 One Million Emojis 😎</span>
          </a>
          <nav className="hidden md:flex space-x-16">
            <NavLinks />
          </nav>
          <div className="relative md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </Button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                <NavLinks mobile />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function NavLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      <AboutModal>
        <p
          className={mobile ? "w-full justify-start px-4 py-2 text-gray-800 hover:bg-gray-100" : "text-white hover:text-blue-200 cursor-pointer"}
        >
          about
        </p>
      </AboutModal>
      <a
        href="https://torresjuan.com/"
        target="_blank"
        className={
          mobile
            ? "block px-4 py-2 text-gray-800 hover:bg-gray-100"
            : "text-white hover:text-blue-200 transition-colors"
        }
      >
        made with ❤️ by juan
      </a>
    </>
  )
}

function AboutModal({ children }: { children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>About</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <p>
            One million emojis, updating in <b>realtime</b> for everyone.
          </p>
          <p>
            Once an emoji is picked, <b>it can't be changed!</b>
          </p>
          <p>
            Let's fill out all one million 😎
          </p>
          <p>
            With heavy inspiration from <a className="text-blue-600 font-bold" href="https://eieio.games/">eieio</a> and <a className="text-blue-600 font-bold" href="https://onemillioncheckboxes.com/">onemillioncheckboxes.com</a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}