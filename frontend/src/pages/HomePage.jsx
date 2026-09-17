import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  aiAnnotationIcon,
  logo,
  manualAnnotationIcon,
  resultAnalysisIcon,
  terminologyIcon,
} from '../assets'

export default function HomePage() {
  useEffect(() => {
    document.title = 'AAIR Lab | Applied AI Research Laboratory'

    const navigation = document.getElementById('top-nav')
    const revealElements = document.querySelectorAll('.reveal')

    const updateNavigation = () => {
      if (!navigation) return
      if (window.scrollY > 50) {
        navigation.classList.add('bg-white/90', 'backdrop-blur-xl', 'shadow-md', 'py-2')
        navigation.classList.remove('bg-transparent', 'py-4')
      } else {
        navigation.classList.remove('bg-white/90', 'backdrop-blur-xl', 'shadow-md', 'py-2')
        navigation.classList.add('bg-transparent', 'py-4')
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('active')
        })
      },
      { threshold: 0.1 },
    )

    revealElements.forEach((element) => observer.observe(element))
    const interactiveElements = document.querySelectorAll('button, a')
    const press = (event) => event.currentTarget.classList.add('scale-95')
    const release = (event) => event.currentTarget.classList.remove('scale-95')
    interactiveElements.forEach((element) => {
      element.addEventListener('mousedown', press)
      element.addEventListener('mouseup', release)
      element.addEventListener('mouseleave', release)
    })
    window.addEventListener('scroll', updateNavigation, { passive: true })
    updateNavigation()

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', updateNavigation)
      interactiveElements.forEach((element) => {
        element.removeEventListener('mousedown', press)
        element.removeEventListener('mouseup', release)
        element.removeEventListener('mouseleave', release)
      })
    }
  }, [])

  return (
    <div className="bg-background text-on-surface font-body-md overflow-x-hidden">
      <nav className="fixed top-0 w-full z-50 transition-all duration-300 bg-transparent py-4" id="top-nav">
        <div className="max-w-container-max mx-auto px-gutter py-4 flex justify-between items-center">
          <div className="flex items-center gap-sm">
            <img alt="AAIR Lab Logo" className="h-8 w-auto object-contain" src={logo} />
            <span className="font-headline-md text-headline-md font-bold text-on-surface">AAIR Lab</span>
          </div>

          <div className="hidden md:flex items-center gap-xl">
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#about">About</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#features">Features</a>
            <div className="flex items-center gap-md ml-lg">
              <Link className="px-lg py-sm rounded-lg font-label-md text-label-md bg-primary text-white shadow-sm hover:shadow-md transition-all" to="/login">
                Get Started
              </Link>
            </div>
          </div>
          <button className="md:hidden text-on-surface" type="button"><span className="material-symbols-outlined">menu</span></button>
        </div>
      </nav>

      <main>
        <section className="relative min-h-screen flex items-center pt-24 overflow-hidden bg-surface-bright">
          <div className="max-w-container-max mx-auto px-gutter grid grid-cols-1 lg:grid-cols-12 gap-xl items-center">
            <div className="lg:col-span-6 z-10 reveal active">
              <span className="inline-block px-4 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-label-md text-label-md mb-md">Advanced AI Systems</span>
              <h1 className="font-display-lg text-display-lg mb-md leading-tight text-on-surface">Applied AI Research Laboratory</h1>
              <h2 className="font-headline-md text-headline-md text-primary mb-lg">Transforming Domain Knowledge into Intelligent Solutions</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-xl max-w-xl">
                An intelligent annotation platform that combines domain expertise with artificial intelligence to accelerate
                data annotation, improve accuracy, and continuously enhance AI model performance.
              </p>
              <div className="flex flex-wrap gap-md" />
            </div>
            <div className="lg:col-span-6 relative reveal active" style={{ transitionDelay: '200ms' }}>
              <div className="relative w-full aspect-square flex items-center justify-center">
                <img alt="AI Research Illustration" className="w-full h-full object-contain drop-shadow-2xl" src={logo} />
              </div>
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10" />
              <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-secondary/10 rounded-full blur-3xl -z-10" />
            </div>
          </div>
        </section>

        <section className="py-3xl bg-surface" id="about">
          <div className="max-w-container-max mx-auto px-gutter">
            <div className="text-center mb-3xl reveal active">
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-sm">About AAIR</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">The future of domain-specific intelligence starts here.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
              <div className="p-xl bg-white rounded-xl shadow-sm border border-outline-variant hover:shadow-md hover:-translate-y-1 transition-all reveal active">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-lg"><span className="material-symbols-outlined">rocket_launch</span></div>
                <h3 className="font-headline-md text-headline-md mb-md">Mission</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">To bridge the gap between human domain expertise and artificial intelligence through seamless annotation workflows and adaptive learning systems.</p>
              </div>
              <div className="p-xl bg-white rounded-xl shadow-sm border border-outline-variant hover:shadow-md hover:-translate-y-1 transition-all reveal active" style={{ transitionDelay: '100ms' }}>
                <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-lg flex items-center justify-center mb-lg"><span className="material-symbols-outlined">visibility</span></div>
                <h3 className="font-headline-md text-headline-md mb-md">Vision</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">Empowering researchers and engineers to build the next generation of highly accurate, specialized AI models for complex industries.</p>
              </div>
              <div className="p-xl bg-white rounded-xl shadow-sm border border-outline-variant hover:shadow-md hover:-translate-y-1 transition-all reveal active" style={{ transitionDelay: '200ms' }}>
                <div className="w-12 h-12 bg-tertiary/10 text-tertiary rounded-lg flex items-center justify-center mb-lg"><span className="material-symbols-outlined">hub</span></div>
                <h3 className="font-headline-md text-headline-md mb-md">Overview</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">AAIR Laboratory serves as a hub for innovation, providing a unified platform for large-scale data processing and research-grade AI orchestration.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-3xl" id="features">
          <div className="max-w-container-max mx-auto px-gutter">
            <div className="text-center mb-3xl reveal active">
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-sm">Core Features</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">Experience a comprehensive suite of tools designed for high-precision AI research.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              <div className="glass-card p-xl rounded-xl group hover:bg-primary/5 hover:shadow-xl hover:-translate-y-2 transition-all reveal active">
                <div className="flex items-start gap-lg">
                  <div className="group-hover:scale-110 transition-transform shrink-0"><img src={manualAnnotationIcon} alt="Manual Annotation Icon" className="w-12 h-12 object-contain" /></div>
                  <div><h3 className="font-headline-md text-headline-md mb-sm">Manual Annotation</h3><p className="font-body-md text-body-md text-on-surface-variant">High-precision tools for manual data tagging with multi-user concurrency and version control for expert review.</p></div>
                </div>
              </div>
              <div className="glass-card p-xl rounded-xl group hover:bg-secondary/5 hover:shadow-xl hover:-translate-y-2 transition-all reveal active" style={{ transitionDelay: '100ms' }}>
                <div className="flex items-start gap-lg">
                  <img src={aiAnnotationIcon} alt="AI Annotation Icon" className="w-12 h-12 object-contain group-hover:scale-110 transition-transform shrink-0" />
                  <div><h3 className="font-headline-md text-headline-md mb-sm">AI Annotation</h3><p className="font-body-md text-body-md text-on-surface-variant">Automated pre-labeling engines that leverage state-of-the-art models to reduce manual workload by up to 80%.</p></div>
                </div>
              </div>
              <div className="glass-card p-xl rounded-xl group hover:bg-tertiary/5 hover:shadow-xl hover:-translate-y-2 transition-all reveal active" style={{ transitionDelay: '200ms' }}>
                <div className="flex items-start gap-lg">
                  <img src={terminologyIcon} alt="Terminology Management Icon" className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" />
                  <div><h3 className="font-headline-md text-headline-md mb-sm">Terminology Management</h3><p className="font-body-md text-body-md text-on-surface-variant">Centralized taxonomy and ontology control to ensure consistency across massive datasets and multiple teams.</p></div>
                </div>
              </div>
              <div className="glass-card p-xl rounded-xl group hover:bg-error/5 hover:shadow-xl hover:-translate-y-2 transition-all reveal active" style={{ transitionDelay: '300ms' }}>
                <div className="flex items-start gap-lg">
                  <img src={resultAnalysisIcon} alt="Result Analysis Icon" className="w-16 h-16 object-contain group-hover:scale-110 transition-transform shrink-0" />
                  <div><h3 className="font-headline-md text-headline-md mb-sm">Result Analysis</h3><p className="font-body-md text-body-md text-on-surface-variant">Comprehensive dashboarding for data distribution, model performance metrics, and annotation quality audits.</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-surface-dim pt-3xl pb-xl border-t border-outline-variant">
        <div className="max-w-container-max mx-auto px-gutter">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2xl mb-2xl">
            <div className="md:col-span-2">
              <div className="flex items-center gap-sm mb-lg"><img alt="AAIR Lab" className="h-8" src={logo} /><span className="font-headline-md text-headline-md font-bold text-on-surface">AAIR Lab</span></div>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-sm mb-lg">Defining the future of specialized intelligent systems through expert-in-the-loop innovation. Scaling domain expertise with AI.</p>
              <div className="flex gap-md">
                <a className="w-10 h-10 rounded-full bg-white border border-outline-variant flex items-center justify-center text-on-surface hover:text-primary transition-all hover:shadow-sm" href="#"><span className="material-symbols-outlined">share</span></a>
                <a className="w-10 h-10 rounded-full bg-white border border-outline-variant flex items-center justify-center text-on-surface hover:text-primary transition-all hover:shadow-sm" href="#"><span className="material-symbols-outlined">alternate_email</span></a>
                <a className="w-10 h-10 rounded-full bg-white border border-outline-variant flex items-center justify-center text-on-surface hover:text-primary transition-all hover:shadow-sm" href="#"><span className="material-symbols-outlined">language</span></a>
              </div>
            </div>
            <div className="ml-auto">
              <h4 className="font-label-md text-label-md font-bold mb-lg text-on-surface">Company</h4>
              <ul className="space-y-sm">
                <li><a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Research Papers</a></li>
                <li><a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Privacy Policy</a></li>
                <li><a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Terms of Service</a></li>
                <li><a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Contact Us</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-xl border-t border-outline-variant flex flex-col md:flex-row justify-between items-center gap-md">
            <p className="font-body-sm text-body-sm text-on-surface-variant">© 2024 Applied AI Research Laboratory (AAIR Lab). All rights reserved.</p>
            <div className="flex gap-md text-on-surface-variant items-center"><span className="material-symbols-outlined text-sm">language</span><span className="font-body-sm text-body-sm">English (Global)</span></div>
          </div>
        </div>
      </footer>
    </div>
  )
}
