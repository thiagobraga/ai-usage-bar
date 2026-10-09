import { Nav }       from './components/Nav'
import { Hero }      from './components/Hero'
import { Features }  from './components/Features'
import { Providers } from './components/Providers'
import { Privacy }   from './components/Privacy'
import { Install }   from './components/Install'
import { Footer }    from './components/Footer'

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Features />
        <Providers />
        <Privacy />
        <Install />
      </main>
      <Footer />
    </>
  )
}
